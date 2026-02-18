export interface Abstract {
  id: string;
  title: string;
  author: string;
  description: string;
  thumbnail: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'document';
  localFileName?: string;
  fileHandle?: FileSystemFileHandle;
  abstractId?: string;
  regId?: string;
  hasFile?: boolean;
  source?: 'hardcoded' | 'local';
}
