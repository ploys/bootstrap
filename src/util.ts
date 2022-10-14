import { getInput } from "@actions/core";
import { exec } from "@actions/exec";
import { argStringToArray } from "@actions/exec/lib/toolrunner";
import { getOctokitOptions, GitHub } from "@actions/github/lib/utils";
import {
    cacheDir,
    downloadTool,
    extractTar,
    extractZip,
    find
} from "@actions/tool-cache";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import fs from "fs";
import { basename } from "path";

const LINUX_TARGETS = [
    "-unknown-linux-gnu",
    "-unknown-linux-musl",
    "-unknown-linux-gnueabihf"
];
const MACOS_TARGETS = ["-apple-darwin"];
const WINDOWS_TARGETS = ["-pc-windows-gnu", "-pc-windows-msvc"];

const X86_TARGETS = ["i686-"];
const X64_TARGETS = ["x86_64-"];
const ARM_TARGETS = ["arm-", "armv7-"];
const ARM64_TARGETS = ["aarch64-"];

/**
 * Gets the repository information.
 */
export function getRepo(): [string, string] {
    const input = getInput("repo") || process.env["GITHUB_REPOSITORY"];

    if (!input) {
        throw new Error("Input required: repo");
    }

    const [owner, repo] = input.split("/");

    if (!owner || !repo) {
        throw new Error("Invalid input: repo");
    }

    return [owner, repo];
}

/**
 * Gets the tags input.
 */
export function getTags(): string[] {
    const tags = (getInput("tags") || "latest")
        .split(",")
        .map(tag => tag.trim());

    return tags;
}

/**
 * Gets the OctoKit API client.
 */
export function getOctokit(): InstanceType<typeof GitHub> {
    if (process.env["GITHUB_TOKEN"]) {
        return new GitHub(getOctokitOptions(process.env["GITHUB_TOKEN"]));
    } else {
        return new GitHub();
    }
}

/**
 * Gets the release tag from the given version.
 *
 * This is used to find the the full `x.y.z` tag used for releases when given
 * another tag such as `x.y` or `x`. This requires that the tag has the same
 * commit SHA if it exists.
 */
export async function getReleaseTag(
    api: InstanceType<typeof GitHub>,
    owner: string,
    repo: string,
    version: string
): Promise<string> {
    if (/[0-9]+.[0-9]+.[0-9]+/.test(version)) {
        return version;
    }

    let sha;

    try {
        const { data: ref } = await api.rest.git.getRef({
            owner,
            repo,
            ref: `tags/${version}`
        });

        if (ref.object.type === "tag") {
            const { data: tag } = await api.rest.git.getTag({
                owner,
                repo,
                tag_sha: ref.object.sha
            });

            sha = tag.object.sha;
        } else {
            sha = ref.object.sha;
        }
    } catch {
        // Do nothing.
    }

    const { data: matches } = await api.rest.git.listMatchingRefs({
        owner,
        repo,
        ref: `tags/${version}`
    });

    if (sha) {
        for (const item of matches.reverse()) {
            if (!/^refs\/tags\/[0-9]+.[0-9]+.[0-9]+$/.test(item.ref)) {
                continue;
            }

            if (item.object.type === "tag") {
                const { data: tag } = await api.rest.git.getTag({
                    owner,
                    repo,
                    tag_sha: item.object.sha
                });

                if (tag.object.sha !== sha) {
                    continue;
                }
            } else if (item.object.sha !== sha) {
                continue;
            }

            return item.ref.substring(10);
        }

        throw new Error(`Could not find matching release for ${version}.`);
    } else {
        const tag = matches
            .filter(item => /refs\/tags\/[0-9]+.[0-9]+.[0-9]+/.test(item.ref))
            .map(item => item.ref.substring(10))
            .reverse()
            .pop();

        if (!tag) {
            throw new Error(`Could not find matching release for ${version}.`);
        }

        return tag;
    }
}

/**
 * Gets the release for the given reference.
 *
 * This handles the special case for the `latest` release which may or may not
 * exist as a tag. If the tag does not exist then it simply uses the existing
 * endpoint for getting the latest release.
 */
export async function getRelease(
    api: InstanceType<typeof GitHub>,
    owner: string,
    repo: string,
    tag: string
): Promise<
    RestEndpointMethodTypes["repos"]["getReleaseByTag"]["response"]["data"]
> {
    try {
        tag = await getReleaseTag(api, owner, repo, tag);

        const { data: release } = await api.rest.repos.getReleaseByTag({
            owner,
            repo,
            tag
        });

        return release;
    } catch (err) {
        if (tag === "latest") {
            const { data: release } = await api.rest.repos.getLatestRelease({
                owner,
                repo
            });

            if (/[0-9]+.[0-9]+.[0-9]+/.test(release.tag_name)) {
                return release;
            }

            throw new Error(
                `Latest release has invalid tag: ${release.tag_name}`
            );
        }

        throw err;
    }
}

/**
 * Gets the release asset matching the given name for the current runner.
 */
export async function getAsset(
    release: RestEndpointMethodTypes["repos"]["getReleaseByTag"]["response"]["data"],
    name: string
): Promise<
    RestEndpointMethodTypes["repos"]["getReleaseByTag"]["response"]["data"]["assets"][0]
> {
    const asset = release.assets
        .filter(asset => asset.name.toLowerCase().startsWith(`${name}-`))
        .filter(asset => {
            switch ((process.env["RUNNER_OS"] || "").toLowerCase()) {
                case "linux": {
                    return LINUX_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                case "macos": {
                    return MACOS_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                case "windows": {
                    return WINDOWS_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                default: {
                    return false;
                }
            }
        })
        .filter(asset => {
            switch ((process.env["RUNNER_ARCH"] || "").toLowerCase()) {
                case "x86": {
                    return X86_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                case "x64": {
                    return X64_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                case "arm": {
                    return ARM_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                case "arm64": {
                    return ARM64_TARGETS.some(target =>
                        asset.name.toLowerCase().includes(target)
                    );
                }
                default: {
                    return false;
                }
            }
        })
        .reverse()
        .pop();

    if (!asset) {
        throw new Error(
            `Could not find matching asset for ${name} in release ${release.tag_name}.`
        );
    }

    return asset;
}

/**
 * Downloads the asset with the given identifier.
 */
export async function downloadAsset(
    owner: string,
    repo: string,
    asset: RestEndpointMethodTypes["repos"]["getReleaseByTag"]["response"]["data"]["assets"][0]
): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`;
    const auth =
        process.env["GITHUB_TOKEN"] && `Bearer ${process.env["GITHUB_TOKEN"]}`;
    const dest = `${process.env["RUNNER_TEMP"]}/${asset.name}`;
    const path = await downloadTool(url, dest, auth, {
        Accept: "application/octet-stream"
    });

    return path;
}

/**
 * Extracts the downloaded release asset.
 */
export async function extractAsset(path: string): Promise<string> {
    if (path.endsWith(".tar.gz")) {
        const dir = await extractTar(path, path.substring(0, path.length - 7));
        const inner = `${dir}/${basename(dir)}`;

        return fs.existsSync(inner) ? inner : dir;
    }

    if (path.endsWith(".zip")) {
        const dir = await extractZip(path, path.substring(0, path.length - 7));
        const inner = `${dir}/${basename(dir)}`;

        return fs.existsSync(inner) ? inner : dir;
    }

    throw new Error(`Unsupported file extension: ${path}`);
}

/**
 * Caches the extracted release asset.
 */
export async function cacheAsset(
    path: string,
    owner: string,
    repo: string,
    name: string,
    version: string
): Promise<string> {
    const tool = `ploys-bootstrap-${owner}-${repo}-${name}`.toLowerCase();

    return await cacheDir(path, tool, version);
}

/**
 * Finds a cached release asset.
 */
export async function findAsset(
    api: InstanceType<typeof GitHub>,
    owner: string,
    repo: string,
    name: string,
    tag: string
): Promise<string | undefined> {
    const tool = `ploys-bootstrap-${owner}-${repo}-${name}`.toLowerCase();

    if (tag === "latest") {
        const release = await getRelease(api, owner, repo, tag);

        return find(tool, release.tag_name);
    }

    return find(tool, tag);
}

/**
 * Executes a command from a release asset path.
 */
export async function execCommand(cmd: string, path: string) {
    const args = argStringToArray(cmd);
    const bin = args.shift();

    if (!bin) {
        throw new Error(`Invalid command: ${cmd}`);
    }

    switch ((process.env["RUNNER_OS"] || "").toLowerCase()) {
        case "linux":
        case "macos": {
            await exec(`${path}/${bin}`, args);

            return;
        }
        case "windows": {
            await exec(`${path}/${bin}.exe`, args);

            return;
        }
        default: {
            throw new Error("Unsupported Runner OS.");
        }
    }
}
