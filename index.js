const DEPT_PATH = "./dept"; // 정리해야할 사진들이 있는 폴더 경로
const ARIV_PATH = "./ariv"; // 정리 된 사진들이 저장될 폴더 경로
const UNKNOWN = "Unknown"; // 정리에 실패한 파일들은 어디로?

const fs = require("fs");
const { parse, format } = require("date-fns");
const ExifReader = require("exifreader");
const path = require("path");

function getFilesFromDept() {
  return fs.readdirSync(DEPT_PATH);
}

function isDateCorrect(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return false;
  }

  if (date.getFullYear() < 2002 || date.valueOf() > new Date().valueOf()) {
    // 02년 ~ 지금 사이의 사진이 아니면 제외
    return false;
  }

  return true;
}

function parseDateFromFileName(fileName) {
  const numberOnlyFileName = fileName.match(/\d+/g).join("");
  let date = null;

  if (numberOnlyFileName.length === 13 || numberOnlyFileName.length === 10) {
    // Epoch Timestamp 의 경우
    date = new Date(parseInt(numberOnlyFileName, 10));
  }

  if (numberOnlyFileName.length >= 14 && numberOnlyFileName.startsWith("20")) {
    // YYYYMMDDHHMMSS 형태의 경우
    const tmp = parse(numberOnlyFileName.slice(0,14), "yyyyMMddHHmmss", new Date());
    date = new Date(format(tmp, "yyyy-MM-dd HH:mm:ss"));
  }

  if (numberOnlyFileName.length === 12) {
    // YYMMDDHHMMSS 형태의 경우
    const tmp = parse(numberOnlyFileName, "yyMMddHHmmss", new Date());
    date = new Date(dateFns.format(tmp, "yyyy-MM-dd HH:mm:ss"));
  }

  return {
    isCorrect: isDateCorrect(date),
    date,
  };
}

async function parseDateFromExif(fileName) {
  const filePath = path.join(DEPT_PATH, fileName);
  const INCORRECT = {
    isCorrect: false,
    date: null,
  }

  try {
    const tags = await ExifReader.load(filePath);
    let dateTimeString = null;
  
    if (!tags) {
      return INCORRECT;
    }
  
    if (tags['DateTime'] && tags['DateTime'].description) {
      dateTimeString = tags['DateTime'].description;
    }

    if (tags['DateTimeOriginal'] && tags['DateTimeOriginal'].description) {
      dateTimeString = tags['DateTimeOriginal'].description;
    }
  
    if (!dateTimeString) {
      return INCORRECT;
    }
  
    return parseDateFromFileName(dateTimeString);
  } catch(ex) {
    return INCORRECT;
  }
}

function copyFile(fromFilePath, toFilePath) {
  try {
    fs.accessSync(toFilePath);
    return false;
  } catch (e) {}

  const toFileFolder = path.dirname(toFilePath);
  if (!fs.existsSync(toFileFolder)) {
    fs.mkdirSync(toFileFolder, { recursive: true });
    fs.chmod(toFileFolder, '0777')
  }

  fs.copyFileSync(fromFilePath, toFilePath);
  fs.chmod(toFilePath, '0777')
}

function generateFolderNameFromDate(date) {
  return format(date, 'yyyy. MM')
}

async function bootstrap() {
  const deptFiles = getFilesFromDept();
  const result = {
    successByFileName: 0,
    successByExif: 0,
    failure: 0,
  };

  for (const deptFile of deptFiles) {
    const dateParseResult = [
      parseDateFromFileName(deptFile),
      await parseDateFromExif(deptFile),
    ];

    if (dateParseResult[0].isCorrect) {
      copyFile(
        path.join(DEPT_PATH, deptFile),
        path.join(
          ARIV_PATH,
          generateFolderNameFromDate(dateParseResult[0].date),
          deptFile
        )
      );
      result.successByFileName++;
      continue;
    }

    if (dateParseResult[1].isCorrect) {
      copyFile(
        path.join(DEPT_PATH, deptFile),
        path.join(
          ARIV_PATH,
          generateFolderNameFromDate(dateParseResult[1].date),
          deptFile
        )
      );
      result.successByExif++;
      continue;
    }

    copyFile(
      path.join(DEPT_PATH, deptFile),
      path.join(ARIV_PATH, UNKNOWN, deptFile)
    );
    result.failure++;
  }

  console.log("정리 완료!");
  console.log(result);
}

bootstrap().catch(console.error);
