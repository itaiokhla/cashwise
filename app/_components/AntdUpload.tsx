import imageCompression from "browser-image-compression";
import React, { useState, useEffect, useRef } from 'react';
import { PlusOutlined, DeleteOutlined ,UploadOutlined} from '@ant-design/icons';
import Upload from 'antd/es/upload';
import Button from 'antd/es/button';
import Tooltip from 'antd/es/tooltip';
import Space from 'antd/es/space';
import Image from 'antd/es/image';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '@/redux/redux.hooks';
import { addFileUrl, removeFileUrl, selectCategoryFiles } from '@/redux/files/filesSlice';
import { toast } from "react-toastify";
import isEqual from 'lodash/isEqual';

// Image compression configuration
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

const MAX_FILE_SIZE_MB = 20;
const MAX_COMPRESS_SIZE = 5 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 0.8;

const getBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const SingleCategoryUpload = ({ category }: { category: string }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  
  const dispatch = useAppDispatch();
  const uploadedUrls = useAppSelector((state) => selectCategoryFiles(state, category));
  const prevUploadedUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isEqual(prevUploadedUrlsRef.current, uploadedUrls)) {
      prevUploadedUrlsRef.current = uploadedUrls;
      const newFileList = uploadedUrls.map((url, index) => ({
        uid: `-${index}`,
        name: url.split('/').pop() || `file-${index}`,
        status: 'done' as const,
        url,
      }));
      setFileList(newFileList);
    }
  }, [uploadedUrls]);

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as File);
    }
    const previewUrl = file.url || (file.preview as string);
    setPreviewImage(previewUrl);
    const index = uploadedUrls.findIndex(u => u === file.url);
    setCurrentPreviewIndex(index);
    setPreviewOpen(true);
  };

  const handleChange = (info: any) => {
    const newFileList = info.fileList;
    const uniqueList = newFileList.filter((file: UploadFile, index: number, self: UploadFile[]) =>
      index === self.findIndex((f) => f.uid === file.uid)
    );
    setFileList(uniqueList);
  };

  const handleDelete = (file: UploadFile) => {
    if (file.url) {
      dispatch(removeFileUrl({ category, url: file.url }));
    }
    setFileList(prev => prev.filter(item => item.uid !== file.uid));
    return true;
  };

  const compressImage = async (file: File) => {
    if (file.size <= MAX_COMPRESS_SIZE) return file;

    try {
      const targetSizeMB = Math.max(
        file.size / (1024 * 1024) * MAX_COMPRESSION_RATIO,
        COMPRESSION_OPTIONS.maxSizeMB
      );

      const compressedFile = await imageCompression(file, {
        ...COMPRESSION_OPTIONS,
        maxSizeMB: targetSizeMB,
      });

      console.log(`Compressed from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
      return compressedFile;
    } catch (error) {
      console.error('Compression failed:', error);
      toast.warning(`Could not compress ${file.name}, uploading original`);
      return file;
    }
  };

  const createCustomRequest = () => {
    return async ({ file, onSuccess, onError }: any) => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        toast.error(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
        onError('File too large');
        return;
      }

      try {
        const processedFile = await compressImage(file);
        const formData = new FormData();
        formData.append('file', processedFile);
        formData.append('category', category);

        const response = await axios.post('/api/fileupload', formData);
        if (response.status === 200) {
          const url = response.data.data.url;
          dispatch(addFileUrl({ category, url }));
          onSuccess(response.data);
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        onError(error);
      }
    };
  };

  const renderPreviewGallery = () => {
    if (!uploadedUrls.length) return null;
    return (
      <Image.PreviewGroup
        preview={{
          visible: previewOpen,
          onVisibleChange: (visible) => setPreviewOpen(visible),
          current: currentPreviewIndex,
          countRender: (current, total) => (
            <Space>
              {`${current}/${total}`}
              <Tooltip title="Delete this image">
                  <span>
                    <Button 
                   
                        onClick={(e:any) => {
                          e.stopPropagation();
                          const fileToDelete = fileList[current - 1];
                          if (fileToDelete) {
                            handleDelete(fileToDelete);
                            setPreviewOpen(false);
                          }
                        }}
                      >
                        <DeleteOutlined />
                    </Button>
                  </span>
              </Tooltip>
            </Space>
          )
        }}
      >
        {uploadedUrls.map((url, index) => (
          <Image key={index} src={url} style={{ display: 'none' }} alt="" />
        ))}
      </Image.PreviewGroup>
    );
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ marginBottom: 8 }} className="text-purple-500">{category}</h4>
      <Upload
        customRequest={createCustomRequest()}
        fileList={fileList}
            listType="picture"
        onPreview={handlePreview}
        onChange={handleChange}
        onRemove={handleDelete}
      >
        {fileList.length >= 3 ? null : (
          <button type="button"  className="flex gap-1 border border-dashed border-gray-400 p-2 rounded-md">
            <UploadOutlined />
            Upload
          </button>
        )}
      </Upload>
      {renderPreviewGallery()}
    </div>
  );
};

const AntdFileUpload = ({ category }: { category: string | string[] }) => {
  const categories = Array.isArray(category) ? category : [category];
  
  return (
    <div>
      {categories.map((cat) => (
        <SingleCategoryUpload key={cat} category={cat} />
      ))}
    </div>
  );
};

export default AntdFileUpload;