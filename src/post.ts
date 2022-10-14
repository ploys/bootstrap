import * as core from "@actions/core";

import * as util from "./util";

/**
 * The entrypoint to the `post` step.
 */
export default async function post(): Promise<void> {
    const cmd = core.getInput("post");

    if (cmd) {
        const path = core.getState("bootstrap_asset_path");

        await util.execCommand(cmd, path);
    }
}

/* istanbul ignore next */
if (require.main === module) {
    post().catch(err => core.setFailed(`${err?.message ?? err}`));
}
