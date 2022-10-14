import fs from "fs";
import nock from "nock";
import path from "path";

import main from "../src/main";

beforeAll(() => {
    nock.disableNetConnect();

    const processStdoutWrite = process.stdout.write.bind(process.stdout);

    process.stdout.write = ((
        str: Uint8Array | string,
        encoding?: BufferEncoding,
        cb?: (err?: Error) => void
    ) => {
        if (!String(str).match(/^::/)) {
            return processStdoutWrite(str, encoding, cb);
        }
    }) as () => boolean;
});

beforeEach(() => {
    process.env["RUNNER_OS"] = "linux";
    process.env["RUNNER_ARCH"] = "x64";

    process.env["INPUT_REPO"] = "octocat/hello-world";
    process.env["INPUT_TAGS"] = "1, 1.0, 1.0.0, latest";
    process.env["INPUT_NAME"] = "my-app";
    process.env["INPUT_MAIN"] = "my-app --key val";
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("main", () => {
    test("found", async () => {
        const util = await import("../src/util");

        jest.spyOn(util, "execCommand").mockImplementation(async () => {
            return;
        });

        jest.spyOn(util, "findAsset").mockImplementation(async () => {
            return "/tmp/my-app";
        });

        await main();
    });

    test("not found", async () => {
        const util = await import("../src/util");

        jest.spyOn(util, "execCommand").mockImplementation(async () => {
            return;
        });

        jest.spyOn(util, "findAsset").mockImplementation(async () => {
            return "";
        });

        await expect(main()).rejects.toThrow();
    });

    test("download", async () => {
        const util = await import("../src/util");

        jest.spyOn(util, "execCommand").mockImplementation(async () => {
            return;
        });

        jest.spyOn(util, "findAsset").mockImplementation(async () => {
            return "";
        });

        jest.spyOn(util, "getRelease").mockImplementation(async () => {
            return JSON.parse(
                fs.readFileSync(
                    path.join(__dirname, "fixtures/release.json"),
                    "utf8"
                )
            );
        });

        jest.spyOn(util, "downloadAsset").mockImplementation(async () => {
            return "/tmp/my-app.tar.gz";
        });

        jest.spyOn(util, "extractAsset").mockImplementation(async () => {
            return "/tmp/my-app";
        });

        jest.spyOn(util, "cacheAsset").mockImplementation(async () => {
            return "/tmp/my-app";
        });

        await main();
    });
});
