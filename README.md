# <img src="./icons/icon-128.png" style="height: 1em; width: 1em;" alt="Icon" /> FS Tools

This is a Chrome / Edge extension that adds extra functionality to make it easier to work on FamilySearch.org and integrate to other geneaoly sites.

**NOTE:** This is my own personal project is not based off FamilySearch source code or associated with FamilySearch in any way.

## Features

FS Tools adds several helpful features to FamilySearch.org, FindAGrave.com, and other helpful genealogical research sites to improve your FamilySearch tree-building experience. Features:

### One-click search for potential duplicates

Sometimes there is another version of the person you are working on somewhere else in the tree. But you won't see a "Possible duplicate" hint on that person unless the system is *very* confident. Experienced users know to go search the tree to see if there is another version of that person somewhere in the tree. Constructing this search takes time.

FS Tools adds a link to the records section of the page that builds that search for you based on the information on the page. You can check for potential duplicates with a single click!

![Tree Search](./docs/img/screenshots/tree-search.png)

### Search from record

When you're looking at a record on FamilySearch and the record isn't attached as a source to a person, the system helpfully shows you a list of what it thinks might be related records along the side. But this is a very short list. And it only shows if the record isn't attached. If you want to search the tree or other records based on the information of a record, you currently have to open up a search window (one for records and one for the tree) and type all the information from the record.

FS Tools adds links to the record to automatically perform a search of the records or tree system based on the information present in the record you're looking at.

![Search from Records Page](./docs/img/screenshots/search-from-records-page.png)

### Full-text search on films

FamilySearch added [a new labs feature called "Full-Text Search"](https://www.familysearch.org/en/labs/) that leverages the power of AI to search films and other images for text. This is especially helpful when you want to read a record from a microfilm scan but the page number is not included in the record. But opening the full-text search tool and building the search parameters for your film is tricky.

FS Tools adds a full-text search box to all film records, allowing you to quickly jump right to the page you want!

![Full-Text Search](./docs/img/screenshots/full-text-search.png)

### Find-a-Grave integration

When browsing Find-a-Grave, FS Tools adds icons linking you from the grave memorial to the corresponding record in FamilySearch. If you have already logged into FamilySearch in your browser, it will even show you whether there is already a person in the tree for that grave record!

![Find-a-Grave integration](./docs/img/screenshots/findagrave-integration.png)

### More features to come

FS Tools is a new extension, and I'm adding features all the time. If you think of an idea you'd like to see, contact me at watkins.dev!

## Installation

I'm working to get this published. In the meantime, you can install the extension manually. Instructions:

1. Download the [latest release](https://github.com/matthewpwatkins/fs-tool/releases/latest/download/fs-tools-chrome.zip).
2. Extract the fs-tools folder to your computer.
3. Open your browser and go to `chrome://extensions`.
4. Enable Developer Mode (if not enabled already).
5. Click "Load unpacked" and select the `fs-tools` directory you extracted.

## Developing locally

1. Clone the repository
2. `npm install`
3. `npm run build`
4. Open a Chromium-based browser (Chrome, Edge, Opera)
5. Go to `chrome://extensions`
6. Enable Developer Mode (if not enabled already)
7. Click "Load unpacked" and select the `dist` directory in the repository.
