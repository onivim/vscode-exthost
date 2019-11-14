// This is a helper script to cherry-pick commits from VSCode
// to Onivim 2.

const { execSync } = require("child_process");
const fs = require("fs");

const shell = (sz) => {
	const ret = execSync(sz);
	const str = ret.toString("utf8").trim();
	console.log(`[${sz}]: ${str}`);
	return str;
};

const currentBranch = shell("git rev-parse --abbrev-ref HEAD");

if (currentBranch !== "master") {
	console.error("Script must be run on MASTER");
	process.exit(0);
}

const log = (msg) => console.log("** INFO: " + msg);

let lastCommit = fs.readFileSync("oni-last-cherry-pick").toString("utf8").trim();
log("Last commit that was cherry-picked: " + lastCommit);

shell("git checkout -b merge-pick-" + lastCommit);

const BATCH_SIZE = 10;

try {
	while (true) {
		for (let i = 0; i < BATCH_SIZE; i++) {
			const commitToPick = shell(`cd ../vscode && git rev-list --ancestry-path ${lastCommit}..HEAD | tail -1`);
			shell(`git merge ${commitToPick}`);
			lastCommit = commitToPick;
		}
		
		shell(`git log --oneline -n${BATCH_SIZE}`);
		console.log("Running yarn install...");
		shell(`yarn install`);
		console.log("Running yarn compile...");
		shell(`yarn compile`);
		console.log("Running tests...");
		shell(`yarn test:oni`);
		console.log("** SUCCESS! **");

		console.log("writing commit to file: " + lastCommit);
		fs.writeFileSync("oni-last-cherry-pick", lastCommit);
	}
} catch (ex) {
	// We finally failed....
	console.log("Ended on commit: " + lastCommit);
}

