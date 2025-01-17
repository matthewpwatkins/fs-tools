# FamilySearch Army Knife

This is a Tampermonkey/GreaseMonkey script that adds extra functionality to make it easier to work on FamilySearch.org.

This is my own personal project is not based off FamilySearch source code or associated with FamilySearch in any way.

## Features

- A search link on the person detail to find other persons in the tree based on the person details
- A full-text search link on Film collections (you must [enable full-text search on your account](https://www.familysearch.org/en/labs/) to use this)
- A FamilySearch button on FindAGrave.com that links directly to the person's grave record in FamilySearch
- [For developers] Adds a menu item to copy your FamilySearch session ID to the clipboard

## Installation

1. Install Tampermonkey or Greasemonkey in your browser if you haven't already.
2. Click [here](https://github.com/matthewpwatkins/fs-army-knife/releases/latest/download/fs-army-knife.user.js) to install the latest version of the script.

That's it!

## Upcoming features

- Full-text search links from record pages

## Suggestions

If you want to suggest new features, reach out to me at watkins.dev

## Developing locally

1. Clone the repository
2. `npm install`
3. `npm run build`
4. The `.user.js` script is output to the dist folder.

## Releases

Just push or pull request into master to create a new release.