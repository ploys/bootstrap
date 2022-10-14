import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import fs from "fs";
import nock from "nock";
import path from "path";

import * as util from "../src/util";

function loadRelease(
    fixture: string
): RestEndpointMethodTypes["repos"]["getReleaseByTag"]["response"]["data"] {
    return JSON.parse(fs.readFileSync(fixture, "utf8"));
}

beforeAll(() => {
    nock.disableNetConnect();
});

beforeEach(() => {
    process.env["GITHUB_REPOSITORY"] = "my-org/my-repo";
    process.env["INPUT_REPO"] = "octocat/hello-world";
    process.env["INPUT_TAGS"] = "1, 1.0, 1.0.0, latest";
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("getRepo", () => {
    test("from input", () => {
        const [owner, repo] = util.getRepo();

        expect(owner).toEqual("octocat");
        expect(repo).toEqual("hello-world");
    });

    test("from env", () => {
        delete process.env["INPUT_REPO"];

        const [owner, repo] = util.getRepo();

        expect(owner).toEqual("my-org");
        expect(repo).toEqual("my-repo");
    });

    test("missing", () => {
        delete process.env["GITHUB_REPOSITORY"];
        delete process.env["INPUT_REPO"];

        expect(util.getRepo).toThrowError();
    });

    test("invalid", () => {
        process.env["INPUT_REPO"] = "octocat";

        expect(util.getRepo).toThrowError();
    });
});

describe("getTags", () => {
    test("from input", async () => {
        const tags = util.getTags();

        expect(tags).toEqual(["1", "1.0", "1.0.0", "latest"]);
    });

    test("without input", async () => {
        delete process.env["INPUT_TAGS"];

        const tags = util.getTags();

        expect(tags).toEqual(["latest"]);
    });
});

describe("getOctokit", () => {
    test("with token", async () => {
        process.env["GITHUB_TOKEN"] = "my-token";

        const octokit = util.getOctokit();
        const auth = (await octokit.auth()) as { type: string };

        expect(auth.type).toBe("token");
    });

    test("without token", async () => {
        delete process.env["GITHUB_TOKEN"];

        const octokit = util.getOctokit();
        const auth = (await octokit.auth()) as { type: string };

        expect(auth.type).toBe("unauthenticated");
    });
});

describe("getReleaseTag", () => {
    test("using x.y.z version", async () => {
        const tag = await util.getReleaseTag(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "1.0.0"
        );

        expect(tag).toEqual("1.0.0");
    });

    test("using untagged x.y version", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/ref/tags%2F1.0")
            .reply(404, {});

        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/matching-refs/tags%2F1.0")
            .reply(200, [
                {
                    ref: "refs/tags/1.0.0",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlLWI=",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0.0",
                    object: {
                        type: "commit",
                        sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                        url: "https://api.github.com/repos/octocat/hello-world/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
                    }
                }
            ]);

        const tag = await util.getReleaseTag(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "1.0"
        );

        expect(tag).toEqual("1.0.0");
    });

    test("using tagged x.y version", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/ref/tags%2F1.0")
            .reply(200, {
                ref: "refs/tags/1.0",
                node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlQQ==",
                url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0",
                object: {
                    type: "tag",
                    sha: "612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac",
                    url: "https://api.github.com/repos/octocat/hello-world/git/tags/612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac"
                }
            });

        nock("https://api.github.com")
            .get(
                "/repos/octocat/hello-world/git/tags/3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15"
            )
            .reply(200, {
                node_id:
                    "MDM6VGFnOTQwYmQzMzYyNDhlZmFlMGY5ZWU1YmM3YjJkNWM5ODU4ODdiMTZhYw==",
                tag: "1.0.1",
                sha: "3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15",
                url: "https://api.github.com/repos/octocat/hello-world/git/tags/3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15",
                message: "initial version",
                tagger: {
                    name: "Monalisa Octocat",
                    email: "octocat@github.com",
                    date: "2014-11-07T22:01:45Z"
                },
                object: {
                    type: "commit",
                    sha: "cbb9a95f325ddbedfb25e153a0f86fb8db8eea7c",
                    url: "https://api.github.com/repos/octocat/hello-world/git/commits/cbb9a95f325ddbedfb25e153a0f86fb8db8eea7c"
                },
                verification: {
                    verified: false,
                    reason: "unsigned",
                    signature: null,
                    payload: null
                }
            });

        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/matching-refs/tags%2F1.0")
            .reply(200, [
                {
                    ref: "refs/tags/1.0",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlQQ==",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0",
                    object: {
                        type: "tag",
                        sha: "612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac",
                        url: "https://api.github.com/repos/octocat/hello-world/git/tags/612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac"
                    }
                },
                {
                    ref: "refs/tags/1.0.0",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlLWI=",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0.0",
                    object: {
                        type: "tag",
                        sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                        url: "https://api.github.com/repos/octocat/hello-world/git/tags/aa218f56b14c9653891f9e74264a383fa43fefbd"
                    }
                },
                {
                    ref: "refs/tags/1.0.1",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlLWI=",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0.1",
                    object: {
                        type: "tag",
                        sha: "3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15",
                        url: "https://api.github.com/repos/octocat/hello-world/git/tags/3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15"
                    }
                },
                {
                    ref: "refs/tags/1.0.2",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlLWI=",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0.2",
                    object: {
                        type: "commit",
                        sha: "3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15",
                        url: "https://api.github.com/repos/octocat/hello-world/git/commits/3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15"
                    }
                },
                {
                    ref: "refs/tags/1.0.0-alpha.1",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlLWI=",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0.0-alpha.1",
                    object: {
                        type: "commit",
                        sha: "940bd336248efae0f9ee5bc7b2d5c985887b16ac",
                        url: "https://api.github.com/repos/octocat/hello-world/git/commits/940bd336248efae0f9ee5bc7b2d5c985887b16ac"
                    }
                }
            ]);

        nock("https://api.github.com")
            .get(
                "/repos/octocat/hello-world/git/tags/612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac"
            )
            .reply(200, {
                node_id:
                    "MDM6VGFnOTQwYmQzMzYyNDhlZmFlMGY5ZWU1YmM3YjJkNWM5ODU4ODdiMTZhYw==",
                tag: "1.0",
                sha: "612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac",
                url: "https://api.github.com/repos/octocat/hello-world/git/tags/612077ae6dffb4d2fbd8ce0cccaa58893b07b5ac",
                message: "initial version",
                tagger: {
                    name: "Monalisa Octocat",
                    email: "octocat@github.com",
                    date: "2014-11-07T22:01:45Z"
                },
                object: {
                    type: "commit",
                    sha: "c3d0be41ecbe669545ee3e94d31ed9a4bc91ee3c",
                    url: "https://api.github.com/repos/octocat/hello-world/git/commits/c3d0be41ecbe669545ee3e94d31ed9a4bc91ee3c"
                },
                verification: {
                    verified: false,
                    reason: "unsigned",
                    signature: null,
                    payload: null
                }
            });

        nock("https://api.github.com")
            .get(
                "/repos/octocat/hello-world/git/tags/aa218f56b14c9653891f9e74264a383fa43fefbd"
            )
            .reply(200, {
                node_id:
                    "MDM6VGFnOTQwYmQzMzYyNDhlZmFlMGY5ZWU1YmM3YjJkNWM5ODU4ODdiMTZhYw==",
                tag: "1.0.0",
                sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                url: "https://api.github.com/repos/octocat/hello-world/git/tags/aa218f56b14c9653891f9e74264a383fa43fefbd",
                message: "initial version",
                tagger: {
                    name: "Monalisa Octocat",
                    email: "octocat@github.com",
                    date: "2014-11-07T22:01:45Z"
                },
                object: {
                    type: "commit",
                    sha: "c3d0be41ecbe669545ee3e94d31ed9a4bc91ee3c",
                    url: "https://api.github.com/repos/octocat/hello-world/git/commits/c3d0be41ecbe669545ee3e94d31ed9a4bc91ee3c"
                },
                verification: {
                    verified: false,
                    reason: "unsigned",
                    signature: null,
                    payload: null
                }
            });

        const tag = await util.getReleaseTag(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "1.0"
        );

        expect(tag).toEqual("1.0.0");
    });

    test("using committed x.y version", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/ref/tags%2F1.0")
            .reply(200, {
                ref: "refs/tags/1.0",
                node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlQQ==",
                url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0",
                object: {
                    type: "commit",
                    sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                    url: "https://api.github.com/repos/octocat/hello-world/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
                }
            });

        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/matching-refs/tags%2F1.0")
            .reply(200, [
                {
                    ref: "refs/tags/1.0",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlQQ==",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0",
                    object: {
                        type: "commit",
                        sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                        url: "https://api.github.com/repos/octocat/hello-world/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
                    }
                },
                {
                    ref: "refs/tags/1.0.0",
                    node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlLWI=",
                    url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0.0",
                    object: {
                        type: "commit",
                        sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                        url: "https://api.github.com/repos/octocat/hello-world/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
                    }
                }
            ]);

        const tag = await util.getReleaseTag(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "1.0"
        );

        expect(tag).toEqual("1.0.0");
    });

    test("no match with sha", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/ref/tags%2F1.0")
            .reply(200, {
                ref: "refs/tags/1.0",
                node_id: "MDM6UmVmcmVmcy9oZWFkcy9mZWF0dXJlQQ==",
                url: "https://api.github.com/repos/octocat/hello-world/git/refs/tags/1.0",
                object: {
                    type: "commit",
                    sha: "aa218f56b14c9653891f9e74264a383fa43fefbd",
                    url: "https://api.github.com/repos/octocat/hello-world/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
                }
            });

        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/matching-refs/tags%2F1.0")
            .reply(200, []);

        await expect(
            util.getReleaseTag(
                util.getOctokit(),
                "octocat",
                "hello-world",
                "1.0"
            )
        ).rejects.toThrow();
    });

    test("no match without sha", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/ref/tags%2F1.0")
            .reply(404, {});

        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/git/matching-refs/tags%2F1.0")
            .reply(200, []);

        await expect(
            util.getReleaseTag(
                util.getOctokit(),
                "octocat",
                "hello-world",
                "1.0"
            )
        ).rejects.toThrow();
    });
});

describe("getRelease", () => {
    test("tagged release", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/releases/tags/1.0.0")
            .reply(200, {
                url: "https://api.github.com/repos/octocat/hello-world/releases/1",
                html_url:
                    "https://github.com/octocat/hello-world/releases/1.0.0",
                assets_url:
                    "https://api.github.com/repos/octocat/hello-world/releases/1/assets",
                upload_url:
                    "https://uploads.github.com/repos/octocat/hello-world/releases/1/assets{?name,label}",
                tarball_url:
                    "https://api.github.com/repos/octocat/hello-world/tarball/1.0.0",
                zipball_url:
                    "https://api.github.com/repos/octocat/hello-world/zipball/1.0.0",
                discussion_url:
                    "https://github.com/octocat/hello-world/discussions/90",
                id: 1,
                node_id: "MDc6UmVsZWFzZTE=",
                tag_name: "1.0.0",
                target_commitish: "main",
                name: "1.0.0",
                body: "Description of the release",
                draft: false,
                prerelease: false,
                created_at: "2013-02-27T19:35:32Z",
                published_at: "2013-02-27T19:35:32Z",
                author: {
                    login: "octocat",
                    id: 1,
                    node_id: "MDQ6VXNlcjE=",
                    avatar_url:
                        "https://github.com/images/error/octocat_happy.gif",
                    gravatar_id: "",
                    url: "https://api.github.com/users/octocat",
                    html_url: "https://github.com/octocat",
                    followers_url:
                        "https://api.github.com/users/octocat/followers",
                    following_url:
                        "https://api.github.com/users/octocat/following{/other_user}",
                    gists_url:
                        "https://api.github.com/users/octocat/gists{/gist_id}",
                    starred_url:
                        "https://api.github.com/users/octocat/starred{/owner}{/repo}",
                    subscriptions_url:
                        "https://api.github.com/users/octocat/subscriptions",
                    organizations_url:
                        "https://api.github.com/users/octocat/orgs",
                    repos_url: "https://api.github.com/users/octocat/repos",
                    events_url:
                        "https://api.github.com/users/octocat/events{/privacy}",
                    received_events_url:
                        "https://api.github.com/users/octocat/received_events",
                    type: "User",
                    site_admin: false
                },
                assets: []
            });

        const release = await util.getRelease(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "1.0.0"
        );

        expect(release).toBeTruthy();
    });

    test("latest release", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/releases/latest")
            .reply(200, {
                url: "https://api.github.com/repos/octocat/hello-world/releases/1",
                html_url:
                    "https://github.com/octocat/hello-world/releases/1.0.0",
                assets_url:
                    "https://api.github.com/repos/octocat/hello-world/releases/1/assets",
                upload_url:
                    "https://uploads.github.com/repos/octocat/hello-world/releases/1/assets{?name,label}",
                tarball_url:
                    "https://api.github.com/repos/octocat/hello-world/tarball/1.0.0",
                zipball_url:
                    "https://api.github.com/repos/octocat/hello-world/zipball/1.0.0",
                discussion_url:
                    "https://github.com/octocat/hello-world/discussions/90",
                id: 1,
                node_id: "MDc6UmVsZWFzZTE=",
                tag_name: "1.0.0",
                target_commitish: "main",
                name: "latest",
                body: "Description of the release",
                draft: false,
                prerelease: false,
                created_at: "2013-02-27T19:35:32Z",
                published_at: "2013-02-27T19:35:32Z",
                author: {
                    login: "octocat",
                    id: 1,
                    node_id: "MDQ6VXNlcjE=",
                    avatar_url:
                        "https://github.com/images/error/octocat_happy.gif",
                    gravatar_id: "",
                    url: "https://api.github.com/users/octocat",
                    html_url: "https://github.com/octocat",
                    followers_url:
                        "https://api.github.com/users/octocat/followers",
                    following_url:
                        "https://api.github.com/users/octocat/following{/other_user}",
                    gists_url:
                        "https://api.github.com/users/octocat/gists{/gist_id}",
                    starred_url:
                        "https://api.github.com/users/octocat/starred{/owner}{/repo}",
                    subscriptions_url:
                        "https://api.github.com/users/octocat/subscriptions",
                    organizations_url:
                        "https://api.github.com/users/octocat/orgs",
                    repos_url: "https://api.github.com/users/octocat/repos",
                    events_url:
                        "https://api.github.com/users/octocat/events{/privacy}",
                    received_events_url:
                        "https://api.github.com/users/octocat/received_events",
                    type: "User",
                    site_admin: false
                },
                assets: []
            });

        const release = await util.getRelease(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "latest"
        );

        expect(release).toBeTruthy();
    });

    test("no release", async () => {
        await expect(
            util.getRelease(
                util.getOctokit(),
                "octocat",
                "hello-world",
                "1.0.0"
            )
        ).rejects.toThrow();
    });

    test("invalid latest version", async () => {
        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/releases/latest")
            .reply(200, {
                url: "https://api.github.com/repos/octocat/hello-world/releases/1",
                html_url:
                    "https://github.com/octocat/hello-world/releases/1.0.0",
                assets_url:
                    "https://api.github.com/repos/octocat/hello-world/releases/1/assets",
                upload_url:
                    "https://uploads.github.com/repos/octocat/hello-world/releases/1/assets{?name,label}",
                tarball_url:
                    "https://api.github.com/repos/octocat/hello-world/tarball/1.0.0",
                zipball_url:
                    "https://api.github.com/repos/octocat/hello-world/zipball/1.0.0",
                discussion_url:
                    "https://github.com/octocat/hello-world/discussions/90",
                id: 1,
                node_id: "MDc6UmVsZWFzZTE=",
                tag_name: "latest",
                target_commitish: "main",
                name: "latest",
                body: "Description of the release",
                draft: false,
                prerelease: false,
                created_at: "2013-02-27T19:35:32Z",
                published_at: "2013-02-27T19:35:32Z",
                author: {
                    login: "octocat",
                    id: 1,
                    node_id: "MDQ6VXNlcjE=",
                    avatar_url:
                        "https://github.com/images/error/octocat_happy.gif",
                    gravatar_id: "",
                    url: "https://api.github.com/users/octocat",
                    html_url: "https://github.com/octocat",
                    followers_url:
                        "https://api.github.com/users/octocat/followers",
                    following_url:
                        "https://api.github.com/users/octocat/following{/other_user}",
                    gists_url:
                        "https://api.github.com/users/octocat/gists{/gist_id}",
                    starred_url:
                        "https://api.github.com/users/octocat/starred{/owner}{/repo}",
                    subscriptions_url:
                        "https://api.github.com/users/octocat/subscriptions",
                    organizations_url:
                        "https://api.github.com/users/octocat/orgs",
                    repos_url: "https://api.github.com/users/octocat/repos",
                    events_url:
                        "https://api.github.com/users/octocat/events{/privacy}",
                    received_events_url:
                        "https://api.github.com/users/octocat/received_events",
                    type: "User",
                    site_admin: false
                },
                assets: []
            });

        await expect(
            util.getRelease(
                util.getOctokit(),
                "octocat",
                "hello-world",
                "latest"
            )
        ).rejects.toThrow();
    });
});

describe("getAsset", () => {
    const release = loadRelease(path.join(__dirname, "fixtures/release.json"));

    test("linux x86", async () => {
        process.env["RUNNER_OS"] = "linux";
        process.env["RUNNER_ARCH"] = "x86";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual(
            "my-app-1.0.0-i686-unknown-linux-musl.tar.gz"
        );
    });

    test("linux x64", async () => {
        process.env["RUNNER_OS"] = "linux";
        process.env["RUNNER_ARCH"] = "x64";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual(
            "my-app-1.0.0-x86_64-unknown-linux-gnu.tar.gz"
        );
    });

    test("linux arm", async () => {
        process.env["RUNNER_OS"] = "linux";
        process.env["RUNNER_ARCH"] = "arm";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual(
            "my-app-1.0.0-armv7-unknown-linux-gnueabihf.tar.gz"
        );
    });

    test("linux arm64", async () => {
        process.env["RUNNER_OS"] = "linux";
        process.env["RUNNER_ARCH"] = "arm64";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual(
            "my-app-1.0.0-aarch64-unknown-linux-gnu.tar.gz"
        );
    });

    test("macos x64", async () => {
        process.env["RUNNER_OS"] = "macos";
        process.env["RUNNER_ARCH"] = "x64";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual("my-app-1.0.0-x86_64-apple-darwin.tar.gz");
    });

    test("macos arm64", async () => {
        process.env["RUNNER_OS"] = "macos";
        process.env["RUNNER_ARCH"] = "arm64";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual("my-app-1.0.0-aarch64-apple-darwin.tar.gz");
    });

    test("windows x86", async () => {
        process.env["RUNNER_OS"] = "windows";
        process.env["RUNNER_ARCH"] = "x86";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual("my-app-1.0.0-i686-pc-windows-gnu.zip");
    });

    test("windows x64", async () => {
        process.env["RUNNER_OS"] = "windows";
        process.env["RUNNER_ARCH"] = "x64";

        const asset = await util.getAsset(release, "my-app");

        expect(asset.name).toEqual("my-app-1.0.0-x86_64-pc-windows-msvc.zip");
    });

    test("invalid os", async () => {
        process.env["RUNNER_OS"] = "android";
        process.env["RUNNER_ARCH"] = "x64";

        await expect(util.getAsset(release, "my-app")).rejects.toThrow();
    });

    test("invalid arch", async () => {
        process.env["RUNNER_OS"] = "windows";
        process.env["RUNNER_ARCH"] = "x16";

        await expect(util.getAsset(release, "my-app")).rejects.toThrow();
    });
});

describe("downloadAsset", () => {
    const temp = path.join(__dirname, "tmp");
    const release = loadRelease(path.join(__dirname, "fixtures/release.json"));

    test("downloadAsset", async () => {
        process.env["RUNNER_TEMP"] = temp;

        const tc = await import("@actions/tool-cache");
        const mock = jest
            .spyOn(tc, "downloadTool")
            .mockImplementation(async (_url, dest) => {
                return dest || "";
            });

        const assetPath = await util.downloadAsset(
            "octocat",
            "hello-world",
            release.assets[0]
        );

        expect(mock).toBeCalled();
        expect(assetPath).toBe(
            path.join(temp, "my-app-1.0.0-x86_64-unknown-linux-gnu.tar.gz")
        );
    });
});

describe("extractAsset", () => {
    const temp = path.join(__dirname, "tmp");

    test("zip", async () => {
        const tc = await import("@actions/tool-cache");
        const mock = jest
            .spyOn(tc, "extractZip")
            .mockImplementation(async (_path, dest) => {
                return dest || "";
            });

        const assetPath = await util.extractAsset(
            path.join(temp, "my-app.zip")
        );

        expect(mock).toBeCalled();
        expect(assetPath).toBe(path.join(temp, "my-app"));
    });

    test("tar.gz", async () => {
        const tc = await import("@actions/tool-cache");
        const mock = jest
            .spyOn(tc, "extractTar")
            .mockImplementation(async (_path, dest) => {
                return dest || "";
            });

        const assetPath = await util.extractAsset(
            path.join(temp, "my-app.tar.gz")
        );

        expect(mock).toBeCalled();
        expect(assetPath).toBe(path.join(temp, "my-app"));
    });

    test("invalid", async () => {
        await expect(
            util.extractAsset(path.join(temp, "my-app.txt"))
        ).rejects.toThrow();
    });
});

describe("cacheAsset", () => {
    const temp = path.join(__dirname, "tmp");

    test("cacheAsset", async () => {
        const tc = await import("@actions/tool-cache");
        const mock = jest
            .spyOn(tc, "cacheDir")
            .mockImplementation(async (_path, tool, version) => {
                return path.join(temp, tool, version);
            });

        const extractPath = path.join(
            temp,
            "ploys-bootstrap-octocat-hello-world-my-app",
            "1.0.0"
        );

        const assetPath = await util.cacheAsset(
            extractPath,
            "octocat",
            "hello-world",
            "my-app",
            "1.0.0"
        );

        expect(mock).toBeCalled();
        expect(assetPath).toBe(
            path.join(
                temp,
                "ploys-bootstrap-octocat-hello-world-my-app",
                "1.0.0"
            )
        );
    });
});

describe("findAsset", () => {
    const release = loadRelease(path.join(__dirname, "fixtures/release.json"));
    const temp = path.join(__dirname, "tmp");

    test("latest", async () => {
        const tc = await import("@actions/tool-cache");
        const mock = jest
            .spyOn(tc, "find")
            .mockImplementation((name, version) => {
                return path.join(temp, name, version);
            });

        nock("https://api.github.com")
            .get("/repos/octocat/hello-world/releases/latest")
            .reply(200, release);

        const assetPath = await util.findAsset(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "my-app",
            "latest"
        );

        expect(mock).toBeCalled();
        expect(assetPath).toBe(
            path.join(
                temp,
                "ploys-bootstrap-octocat-hello-world-my-app",
                "1.0.0"
            )
        );
    });

    test("versioned", async () => {
        const tc = await import("@actions/tool-cache");
        const mock = jest
            .spyOn(tc, "find")
            .mockImplementation((name, version) => {
                return path.join(temp, name, version);
            });

        const assetPath = await util.findAsset(
            util.getOctokit(),
            "octocat",
            "hello-world",
            "my-app",
            "1.0.0"
        );

        expect(mock).toBeCalled();
        expect(assetPath).toBe(
            path.join(
                temp,
                "ploys-bootstrap-octocat-hello-world-my-app",
                "1.0.0"
            )
        );
    });
});

describe("execCommand", () => {
    const temp = path.join(__dirname, "tmp");

    test("linux", async () => {
        process.env["RUNNER_OS"] = "linux";

        let bin: string | undefined, args: string[] | undefined;

        const exec = await import("@actions/exec");
        const mock = jest
            .spyOn(exec, "exec")
            .mockImplementation(async (a, b) => {
                bin = a;
                args = b;

                return 0;
            });

        await util.execCommand("my_app --key val", temp);

        expect(mock).toBeCalled();
        expect(bin).toBe(path.join(temp, "my_app"));
        expect(args).toEqual(["--key", "val"]);
    });

    test("macos", async () => {
        process.env["RUNNER_OS"] = "macos";

        let bin: string | undefined, args: string[] | undefined;

        const exec = await import("@actions/exec");
        const mock = jest
            .spyOn(exec, "exec")
            .mockImplementation(async (a, b) => {
                bin = a;
                args = b;

                return 0;
            });

        await util.execCommand("my_app --key val", temp);

        expect(mock).toBeCalled();
        expect(bin).toBe(path.join(temp, "my_app"));
        expect(args).toEqual(["--key", "val"]);
    });

    test("windows", async () => {
        process.env["RUNNER_OS"] = "windows";

        let bin: string | undefined, args: string[] | undefined;

        const exec = await import("@actions/exec");
        const mock = jest
            .spyOn(exec, "exec")
            .mockImplementation(async (a, b) => {
                bin = a;
                args = b;

                return 0;
            });

        await util.execCommand("my_app --key val", temp);

        expect(mock).toBeCalled();
        expect(bin).toBe(path.join(temp, "my_app.exe"));
        expect(args).toEqual(["--key", "val"]);
    });

    test("invalid", async () => {
        delete process.env["RUNNER_OS"];

        const exec = await import("@actions/exec");
        const mock = jest.spyOn(exec, "exec").mockImplementation(async () => {
            return 0;
        });

        expect(mock).not.toBeCalled();

        await expect(util.execCommand("", temp)).rejects.toThrow();
        await expect(
            util.execCommand("my_app --key val", temp)
        ).rejects.toThrow();
    });
});
