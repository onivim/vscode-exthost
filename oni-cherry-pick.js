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

shell("git checkout -b cherry-pick-" + lastCommit);

const BATCH_SIZE = 5;

try {
	while (true) {
		for (let i = 0; i < BATCH_SIZE; i++) {
			const commitToPick = shell(`cd ../vscode && git rev-list --ancestry-path ${lastCommit}..HEAD | tail -1`);
			shell(`git cherry-pick ${commitToPick}`);
			lastCommit = commitToPick;
		}
		
		shell(`yarn install`);
		shell(`yarn compile`);
		console.log("SUCCESS!");
	}
} catch (ex) {
	// We finally failed....
	console.log("Ended on commit: " + lastCommit);
}



