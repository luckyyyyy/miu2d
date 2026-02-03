/**
 * File System Access API 类型扩展
 * 添加对现代 File System API 的类型支持
 */

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
  }): Promise<FileSystemDirectoryHandle>;

  showOpenFilePicker(options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle[]>;

  showSaveFilePicker(options?: {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle>;
}

/**
 * 扩展 DataTransferItem 以支持 getAsFileSystemHandle
 * 这是拖放时获取文件系统句柄的方法，可以绕过 Chrome 对 .ini/.cfg/.dll 的限制
 */
interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
}
