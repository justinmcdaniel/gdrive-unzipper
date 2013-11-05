//Unzip, specifically, an anki *.apkg file at the moment. 
function extractFileByName(name) {
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
  var zipFileId = file.getId();
  var extractionFolderId = destFolder.getId();
  var fileBlob = file.getBlob().setContentType('application/zip'); //Force correct zip content type because Google's stuff blows up otherwise.
  var unzippedBlobs = Utilities.unzip(fileBlob);
  
  __createWorkloads(zipFileId, extractionFolderId, unzippedBlobs);
}

function __clearDb() {
  var db = ScriptDb.getMyDb();
  while (true) {
    var result = db.query({}); // Get everything, up to limit.
    if (result.getSize() == 0) {
      break;
    }
    while (result.hasNext()) {
      db.remove(result.next());
    }
  }
}

function __countItemsInDb() {
  var db = ScriptDb.getMyDb();
  result = db.query({});
  Logger.log(result.getSize());
}


function __createWorkloads(zipFileId, extractionFolderId, unzippedBlobs) {
  var db = ScriptDb.getMyDb();
  var workloads = [];
  var workloadSize = 5;
  var workloadsNeededCount = unzippedBlobs.length / workloadSize + (unzippedBlobs.length % workloadSize == 0 ? 0 : 1);
  
  for (var i = 0; i < workloadsNeededCount; ++i) {
    workload = {
      type: 'workload/zip',
      zipFileId: zipFileId,
      extractionFolderId: extractionFolderId,
      startIndex: i * workloadSize,
      workloadSize: workloadSize,
      workloadProcessing: false
    };
    workloads.push(workload);
  }
  
  var result = db.saveBatch(workloads, false);
  if (db.allOk(result)) { Logger.log("All saved!"); } else { Logger.log("I DON'T UNDERSTAND!!!"); }
  
  for (var i = 0; i < 5; ++i) {
    __spawnWorker();
  }
}

function __spawnWorker() {
  // One-time execution only
  // Use JavaScript Date of 5/17/2012
  var date = new Date();
  date.setSeconds(date.getSeconds() + 10);
  var oneTimeOnly = ScriptApp.newTrigger("__doWork")
      .timeBased()
      .at(date)
      .create();
}

function __doWork() { //Function called by Timed Trigger (a.k.a. "a worker").
  var workloadId = __fetchWorkload();
  if (workloadId != null) {
    var success = __processWorkload(workloadId)
    if (success) {
      var db = ScriptDb.getMyDb();
      db.removeById(workloadId);
    }
    else {
      //TODO: Fail gracefully. Retry?
    }
  }
}

function __fetchWorkload() {
  var db = ScriptDb.getMyDb();
  var lock = LockService.getPublicLock();
  lock.waitLock(10000);
  try {
    var queryResult = db.query({type: 'workload/zip', workloadProcessing: false}).limit(1);
    if (queryResult.hasNext()) {
      var workload = queryResult.next();
      var workloadId = workload.getId();
      
      workload.workloadProcessing = true;
      db.save(workload);
      return workloadId;
    }
    else {
      return null;
    }
  } finally { // Make sure the lock is released even if we blow up.
    lock.releaseLock();
  }
}

function __processWorkload(workloadId) {
  var db = ScriptDb.getMyDb();
  var workload = db.load(workloadId);
  
  var zipFile = DriveApp.getFileById(workload.zipFileId);
  var fileBlob = zipFile.getBlob().setContentType('application/zip');
  var destFolder = DriveApp.getFolderById(workload.extractionFolderId);
  var unzippedBlobs = Utilities.unzip(fileBlob);
  
  for (var i = workload.startIndex; i < workload.startIndex + workload.workloadSize; ++i) {
    destFolder.createFile(unzippedBlobs[i].setContentType('application/unknown'));
  }
  
  return true;
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