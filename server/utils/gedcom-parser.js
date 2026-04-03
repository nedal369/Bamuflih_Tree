/**
 * Shared GEDCOM 5.5.1 parser
 * Extracts individuals and families from GEDCOM text format
 */

function parseGedcom(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const individuals = new Map(); // gedcom id -> data
  const families = new Map();    // gedcom id -> data
  const errors = [];

  let currentRecord = null;  // { type: 'INDI'|'FAM', id, data }
  let currentTag = null;     // level-1 tag currently being processed

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(/^(\d+)\s+(@\S+@\s+)?(\S+)(.*)$/);
    if (!match) {
      errors.push(`سطر ${i + 1}: تنسيق غير صالح`);
      continue;
    }

    const level = parseInt(match[1], 10);
    const tag = match[3];
    const value = (match[4] || '').trim();

    // Level 0: new record or header/trailer
    if (level === 0) {
      // Save previous record
      saveRecord(currentRecord, individuals, families);
      currentRecord = null;
      currentTag = null;

      // Check if this is a record definition like "0 @I1@ INDI"
      if (match[2]) {
        const recordId = match[2].trim();
        if (tag === 'INDI') {
          currentRecord = { type: 'INDI', id: recordId, data: {} };
        } else if (tag === 'FAM') {
          currentRecord = { type: 'FAM', id: recordId, data: { children: [] } };
        }
      }
      continue;
    }

    if (!currentRecord) continue;

    // Level 1 tags
    if (level === 1) {
      currentTag = tag;

      if (currentRecord.type === 'INDI') {
        switch (tag) {
          case 'NAME':
            // Clean GEDCOM name format: remove slashes around surname
            currentRecord.data.name = value.replace(/\//g, '').trim();
            break;
          case 'SEX':
            currentRecord.data.sex = value;
            break;
          case 'BIRT':
            currentRecord.data._currentEvent = 'birth';
            break;
          case 'DEAT':
            currentRecord.data._currentEvent = 'death';
            break;
          case 'RESI':
            currentRecord.data._currentEvent = 'resi';
            break;
          case 'OCCU':
            currentRecord.data.occupation = value;
            break;
          case 'NOTE':
            handleNote(currentRecord.data, value);
            break;
          case 'PHON':
            currentRecord.data.phone = value;
            break;
          case 'FAMS':
            if (!currentRecord.data.fams) currentRecord.data.fams = [];
            currentRecord.data.fams.push(value.replace(/@/g, ''));
            break;
          case 'FAMC':
            if (!currentRecord.data.famc) currentRecord.data.famc = [];
            currentRecord.data.famc.push(value.replace(/@/g, ''));
            break;
          default:
            break;
        }
      } else if (currentRecord.type === 'FAM') {
        switch (tag) {
          case 'HUSB':
            currentRecord.data.husband = value.replace(/@/g, '');
            break;
          case 'WIFE':
            currentRecord.data.wife = value.replace(/@/g, '');
            break;
          case 'CHIL':
            currentRecord.data.children.push(value.replace(/@/g, ''));
            break;
          case 'NOTE':
            handleFamNote(currentRecord.data, value);
            break;
          default:
            break;
        }
      }
      continue;
    }

    // Level 2 tags (sub-tags)
    if (level === 2 && currentRecord.type === 'INDI') {
      const event = currentRecord.data._currentEvent;
      switch (tag) {
        case 'DATE':
          if (event === 'birth') currentRecord.data.birthDate = value;
          else if (event === 'death') currentRecord.data.deathDate = value;
          break;
        case 'PLAC':
          if (event === 'birth') {
            if (!currentRecord.data.city) currentRecord.data.city = value;
          } else if (event === 'death') {
            // store but don't overwrite city
          } else if (event === 'resi') {
            currentRecord.data.city = value;
          }
          break;
        default:
          break;
      }
    }

    // Handle CONC/CONT continuation lines for notes
    if ((tag === 'CONC' || tag === 'CONT') && currentRecord.type === 'INDI' && currentTag === 'NOTE') {
      const separator = tag === 'CONT' ? '\n' : '';
      if (currentRecord.data.bio) {
        currentRecord.data.bio += separator + value;
      }
    }
  }

  // Save last record
  saveRecord(currentRecord, individuals, families);

  return { individuals, families, errors };
}

function saveRecord(record, individuals, families) {
  if (!record) return;
  // Clean up internal markers
  if (record.data._currentEvent) delete record.data._currentEvent;
  if (record.type === 'INDI') {
    individuals.set(record.id, record.data);
  } else if (record.type === 'FAM') {
    families.set(record.id, record.data);
  }
}

function handleNote(data, value) {
  if (value.startsWith('MOTHER_NAME:')) {
    data.motherName = value.replace('MOTHER_NAME:', '').trim();
  } else if (value.startsWith('NATIONALITY:')) {
    data.nationality = value.replace('NATIONALITY:', '').trim();
  } else if (value.startsWith('WORK_TYPE:')) {
    data.workType = value.replace('WORK_TYPE:', '').trim();
  } else if (value.startsWith('WORK_PLACE:')) {
    data.workPlace = value.replace('WORK_PLACE:', '').trim();
  } else {
    // General bio note - append if existing
    data.bio = data.bio ? data.bio + '\n' + value : value;
  }
}

function handleFamNote(data, value) {
  if (value.startsWith('WIFE_NAME:')) {
    data.wifeName = value.replace('WIFE_NAME:', '').trim();
  }
}

module.exports = { parseGedcom, saveRecord, handleNote, handleFamNote };
