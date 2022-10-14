import * as core from "@actions/core";

import * as util from "./util";

/**
 * The entrypoint to the `main` step.
 */
export default async function main(): Promise<void> {
    const [owner, repo] = util.getRepo();
    const tags = util.getTags();
    const name = core.getInput("name", { required: true });
    const cmd = core.getInput("main", { required: true });
    const api = util.getOctokit();

    for (const tag of tags) {
        const path = await util.findAsset(api, owner, repo, name, tag);

        if (path) {
            await util.execCommand(cmd, path);

            core.saveState("bootstrap_asset_path", path);

            return;
        }
    }

    for (const [idx, tag] of tags.entries()) {
        try {
            const release = await util.getRelease(api, owner, repo, tag);
            const asset = await util.getAsset(release, name);
            const downloadPath = await util.downloadAsset(owner, repo, asset);
            const extractPath = await util.extractAsset(downloadPath);
            const cachePath = await util.cacheAsset(
                extractPath,
                owner,
                repo,
                name,
                release.tag_name
            );

            await util.execCommand(cmd, cachePath);

            core.saveState("bootstrap_asset_path", cachePath);

            return;
        } catch (err) {
            if (idx == tags.length - 1) {
                throw err;
            } else {
                core.warning(err as Error);

                continue;
            }
        }
    }
}

/* istanbul ignore next */
if (require.main === module) {
    main().catch(err => core.setFailed(`${err?.message ?? err}`));
}
