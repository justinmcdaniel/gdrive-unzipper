
function extractFileByName(name) {
  //name = 'Test_Extraction_Zip.apkg';
  name = 'Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images.apkg';
  var files = DriveApp.getFilesByName(name);
  if (files.hasNext()) { // If the file exists...
    var file = files.next();
    var parentFolder = __getFileParent(file);
    var extractionFolder = __createFolderForZipExtraction(file.getName(), parentFolder);
    __unzipFileIntoFolder(file, extractionFolder);
  }
}

//function logDatabaseItems() {
//  var db = ScriptDb.getMyDb();
//  result = db.query({index: db.anyValue()});
//  while (result.hasNext()) {
//    item = result.next();
//    Logger.log(item.name);
//  }
//}


//private:

function __unzipFileIntoFolder(file, destFolder) {
  // TODO: Additional checks to make sure this is some sort of compatible zip... probably won't be more than a guess if anything.
  var fileBlob = file.getBlob().setContentType('application/zip'); //Force correct zip content type because Google's stuff blows up otherwise.
  var unzippedBlobs = Utilities.unzip(fileBlob);
  __shoveBlobsInDb(unzippedBlobs);
//  for (var i = 0; i < unzippedBlobs.length; ++i) {
//    destFolder.createFile(unzippedBlobs[i].setContentType('application/unknown'));
//  }
}

function __shoveBlobsInDb(blobs) {
  var db = ScriptDb.getMyDb();
  var items = []
  for (var i = 0; i < 10; ++i) {
    item = {
      index: i,
      name: blobs[i].getName(),
      data: blobs[i].getDataAsString()
    }
    items.push(item);
  }
  db.saveBatch(items, false);
}

function __getFileParent(file) { //Assumption: A "File" should always have a parent. Not true for a "Folder".
  var parents = file.getParents();
  if (parents.hasNext()) parent = parents.next();
  return parent;
}

function __createFolderForZipExtraction(apkgFileName, folder) {
  var newFolderName = apkgFileName.replace(/\.[^/.]+$/, "");
  var subFolders = folder.getFoldersByName(newFolderName);
  var count = 1;
  var counterUsed = false;
  
  while (subFolders.hasNext()) {
    counterUsed = true;
    subFolders = folder.getFoldersByName(newFolderName + " (" + count++ + ")");
  }
  
  if (counterUsed) newFolderName = newFolderName + " (" + --count + ")";
  
  return folder.createFolder(newFolderName);
}