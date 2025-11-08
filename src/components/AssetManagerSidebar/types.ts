export interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
  schema?: Record<string, any>;
  contains?: {
    type: string;
    parts?: Array<{
      assetType: string;
      allowedExtensions?: string[];
      maxSize?: number;
      schema?: Record<string, any>;
    }>;
  };
}

export interface AssetFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  download_url: string;
}
