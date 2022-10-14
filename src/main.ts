import * as core from "@actions/core";

/**
 * The entrypoint to the `main` step.
 */
export default async function main(): Promise<void> {
    core.info("Hello, world!");
}

/* istanbul ignore next */
if (require.main === module) {
    main();
}
