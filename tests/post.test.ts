import nock from "nock";

import post from "../src/post";

beforeAll(() => {
    nock.disableNetConnect();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("post", () => {
    test("ok", async () => {
        process.env["INPUT_POST"] = "my-app --key val";
        process.env["STATE_bootstrap_asset_path"] = "my-app";

        const util = await import("../src/util");

        jest.spyOn(util, "execCommand").mockImplementation(async () => {
            return;
        });

        await post();
    });
});
