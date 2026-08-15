import { gapi } from 'gapi-script';
import { db } from './db';

const FILE_NAME = 'finance_backup.json';

// Initialize the GAPI client for Drive
export const initGoogleDriveApi = async () => {
  return new Promise<void>((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        resolve();
      } catch (err) {
        console.error('Error initializing GAPI client', err);
        reject(err);
      }
    });
  });
};

// Set token
export const setGoogleToken = (accessToken: string) => {
  gapi.client.setToken({ access_token: accessToken });
};

// Find the backup file in appDataFolder
const findBackupFile = async (): Promise<string | null> => {
  const response = await (gapi.client as any).drive.files.list({
    spaces: 'appDataFolder',
    fields: 'files(id, name)',
    q: `name='${FILE_NAME}'`,
  });
  const files = response.result.files;
  if (files && files.length > 0) {
    return files[0].id || null;
  }
  return null;
};

// Upload a new backup
export const uploadBackup = async (accessToken: string) => {
  setGoogleToken(accessToken);
  try {
    const blob = await db.export();
    const existingFileId = await findBackupFile();

    const metadata = {
      name: FILE_NAME,
      parents: ['appDataFolder'],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
      method = 'PATCH';
      // When updating, 'parents' should not be sent
      const updateMetadata = { name: FILE_NAME };
      const updateForm = new FormData();
      updateForm.append('metadata', new Blob([JSON.stringify(updateMetadata)], { type: 'application/json' }));
      updateForm.append('file', blob);
      
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}` },
        body: updateForm,
      });
      return await res.json();
    } else {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      return await res.json();
    }
  } catch (error) {
    console.error('Error uploading backup:', error);
    throw error;
  }
};

// Download existing backup
export const downloadBackup = async (accessToken: string): Promise<Blob | null> => {
  setGoogleToken(accessToken);
  try {
    const fileId = await findBackupFile();
    if (!fileId) return null;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) throw new Error('Failed to download file');
    
    return await response.blob();
  } catch (error) {
    console.error('Error downloading backup:', error);
    throw error;
  }
};

// Import backup from drive to Dexie
export const restoreFromDrive = async (accessToken: string) => {
  const blob = await downloadBackup(accessToken);
  if (!blob) {
    throw new Error('Nenhum backup encontrado no Google Drive.');
  }
  await db.delete();
  await db.open();
  await db.import(blob);
};
