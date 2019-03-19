import * as ExtensionHost from "./ExtensionHost";

describe("initialization", () => {
    test("extension host process gets initialized", async () => {

        await ExtensionHost.withExtensionHost([], async (api) => {
            // expect(true).toBe(true);
            await api.start();
            return Promise.resolve();
        });
    });
});
