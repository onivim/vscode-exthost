/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Outrun Labs, LLC. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require("path");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");

const fs = require("fs-extra");

const rootDir = path.join(__dirname, "..", "..");
const publishDir = path.join(rootDir, "_package_extensions");
const extensionsDir = path.join(rootDir, "extensions");

console.log(`Removing existing publish directory: ${publishDir}..`);
rimraf.sync(publishDir);

console.log(`Creating new publish directory: ${publishDir}...`);
mkdirp.sync(publishDir);

const extensionsToInclude = [
	"bat",
	"clojure",
	"coffeescript",
	"cpp",
	"csharp",
	"css",
	"css-language-features",
	"docker",
	"fsharp",
	"git",
	"go",
	"groovy",
	"grunt",
	"gulp",
	"handlebars",
	"hlsl",
	"html",
	"html-language-features",
	"ini",
	"jake",
	"java",
	"javascript",
	"json",
	"json-language-features",
	"less",
	"log",
	"lua",
	"make",
	"markdown-basics",
	"markdown-language-features",
	"merge-conflict",
	"npm",
	"objective-c",
	"perl",
	"php",
	"php-language-features",
	"powershell",
	"pug",
	"python",
	"r",
	"razor",
	"ruby",
	"rust",
	"scss",
	"shaderlab",
	"shellscript",
	"sql",
	"swift",
	"theme-abyss",
	"theme-defaults",
	"theme-kimbie-dark",
	"theme-monokai",
	"theme-monokai-dimmed",
	"theme-quietlight",
	"theme-red",
	"theme-seti",
	"theme-solarized-dark",
	"theme-solarized-light",
	"theme-tomorrow-night-blue",
	"types",
	"typescript-basics",
	"typescript-language-features",
	"xml",
	"yaml",
];

extensionsToInclude.forEach(extension => {
	const extensionPath = path.join(extensionsDir, extension);
	const outPath = path.join(publishDir, extension);
	console.log(`Copying ${extensionPath} to ${outPath}...`)
	fs.copySync(extensionPath, outPath);
})

// console.log(`Copying ${outDir} to ${packageOutDir}...`)
// fs.copySync(outDir, packageOutDir);

// console.log(`Copying ${srcPackageJson} to ${destPackageJson}`);
// fs.copySync(srcPackageJson, destPackageJson);

// console.log(`Copying ${srcProductJson} to ${destProductJson}`);
// fs.copySync(srcProductJson, destProductJson);


// pathsToRemove.forEach((p) => {
// 	const pathToRemove = path.join(packageOutDir, p);
// 	console.log("Remove path: " + pathToRemove);
// 	rimraf.sync(pathToRemove);
// });
