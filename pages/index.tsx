import { useRouter } from 'next/router';
import axios from 'axios';
import { ChangeEvent, useState } from 'react';

async function uploadToS3(file: File, onUploadProgress: (progressEvent: ProgressEvent) => void) {
  try {
    const fileType = encodeURIComponent(file.type);

    const { data } = await axios.get(`/api/media?fileType=${fileType}`, {
      onUploadProgress,
    });

    const { uploadUrl, key } = data;

    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress,
    });

    return key;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

async function textractLambda(key: string, onDownloadProgress: (progressEvent: ProgressEvent) => void) {
  try {
    const payload = {
      "Records": [
        {
          "s3": {
            "bucket": {
              "name": process.env.NEXT_PUBLIC_BUCKET_NAME
            },
            "object": {
              "key": key
            }
          }
        }
      ]
    };

    console.log('Calling Lambda function with URL:', process.env.NEXT_PUBLIC_EXTRACT_URL);
    console.log('Using bucket name:', process.env.NEXT_PUBLIC_BUCKET_NAME);

    const response = await axios({
      method: 'POST',
      url: process.env.NEXT_PUBLIC_EXTRACT_URL,
      data: payload,
      onDownloadProgress
    });

    return response.data.body;
  } catch (error) {
    console.error('Error calling Lambda function:', error);
    throw error;
  }
}

async function rekognitionLambda(key: string, onDownloadProgress: (progressEvent: ProgressEvent) => void) {
  try {
    const payload = {
      "Records": [
        {
          "s3": {
            "bucket": {
              "name": process.env.NEXT_PUBLIC_BUCKET_NAME
            },
            "object": {
              "key": key
            }
          }
        }
      ]
    };

    console.log('Calling Rekognition Lambda function with URL:', process.env.NEXT_PUBLIC_RECOGNIZE_URL);
    console.log('Using bucket name:', process.env.NEXT_PUBLIC_BUCKET_NAME);

    const response = await axios({
      method: 'POST',
      url: process.env.NEXT_PUBLIC_RECOGNIZE_URL,
      data: payload,
      onDownloadProgress
    });

    return response.data.body;
  } catch (error) {
    console.error('Error calling Rekognition Lambda function:', error);
    throw error;
  }
}


function saveTextAsFile(text: string) {
  const formattedText = text.replace(/\\n/g, '\n');

  const blob = new Blob([formattedText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  return url;
}

function formatTextForHTML(text: string) {
  return text.replace(/\\n/g, '<br>');
}

function Upload() {
  const router = useRouter();
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractType, setExtractType] = useState<string>('textract');

async function handleSubmit(e: ChangeEvent<HTMLFormElement>) {
  e.preventDefault();
  if (!selectedFile) return;

  setLoading(true);

  try {
    const key = await uploadToS3(selectedFile, (progressEvent) => {
      const progressPercentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      setProgress(progressPercentage);
    });

    let extractedData;
    if (extractType === 'textract') {
      extractedData = await textractLambda(key, (progressEvent) => {
        const progressPercentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setProgress(progressPercentage);
      });
    } else if (extractType === 'rekognition') {
      extractedData = await rekognitionLambda(key, (progressEvent) => {
        const progressPercentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setProgress(progressPercentage);
      });
    }

    setResult(extractedData);
  } catch (error) {
    setResult('An error occurred. Please try again later.');
  } finally {
    setLoading(false);
    setProgress(0);
  }
}

  function handleDownloadClick() {
    const downloadUrl = saveTextAsFile(result);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }

  function handleClear() {
    setSelectedFile(null);
    setResult('');
    setProgress(0);
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    setSelectedFile(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    setSelectedFile(file);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', width: '100%', padding: '20px', textAlign: 'center' }}>
        <h1>ImageInsight</h1>
        <p>Extract text and labels from images with ease!</p>
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          {selectedFile ? (
            <div 
              onDrop={handleDrop} 
              onDragOver={handleDragOver} 
              style={{ border: '2px dashed #ccc', padding: '40px', textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={URL.createObjectURL(selectedFile)} alt="Selected file" style={{ maxWidth: '100%', maxHeight: '100px', display: 'block', margin: '0 auto' }} />
                <p style={{ textAlign: 'center' }}>{selectedFile.name}</p>
              </div>
            </div>
          ) : (
            <div 
              onDrop={handleDrop} 
              onDragOver={handleDragOver} 
              style={{ border: '2px dashed #ccc', padding: '40px', textAlign: 'center', cursor: 'pointer' }}
            >
              <p>Drag & drop files here</p>
              <p>Supported formats: JPG, PNG</p>
              <br></br>
              <label htmlFor="fileInput" style={{ backgroundColor: 'green', color: 'white', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>Browse Files</label>
            </div>
          )}
          <br />
          
          <input id="fileInput" type="file" accept="image/jpeg,image/png" name="file" style={{ display: 'none' }} onChange={handleFileInputChange} />
          <br />
          <div style={{ display: 'flex', justifyContent: 'center'}}>
          <button type="submit" onClick={() => setExtractType('textract')} disabled={loading || !selectedFile} style={{ backgroundColor: 'green', color: 'white', padding: '15px 30px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '10px' }}>Extract Text</button>
          <button type="submit" onClick={() => setExtractType('rekognition')} disabled={loading || !selectedFile} style={{ backgroundColor: 'orange', color: 'white', padding: '15px 30px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '10px' }}>Extract Labels</button>
            <button type="button" onClick={handleClear} style={{ backgroundColor: 'red', color: 'white', padding: '15px 30px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Clear All</button>
          </div>
        </form>
        {loading && <progress value={progress} max={100} style={{ width: '100%' }} />}
        {loading && <p>Your file is being processed...</p>}
        <h2>Result</h2>
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '5px' }} dangerouslySetInnerHTML={{ __html: formatTextForHTML(result) }}></div>
        {result && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button onClick={handleDownloadClick} style={{ backgroundColor: 'blue', color: 'white', padding: '15px 30px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Download Text</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Upload;
