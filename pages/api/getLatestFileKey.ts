import { NextApiRequest, NextApiResponse } from 'next';
import S3, { ListObjectsV2Request, ListObjectsV2Output, ObjectList, Object } from 'aws-sdk/clients/s3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.NEXT_PUBLIC_BUCKET_NAME) {
        return res.status(500).json({ error: 'NEXT_PUBLIC_BUCKET_NAME environment variable is not defined' });
    }

    const s3 = new S3({
        apiVersion: '2006-03-01',
        accessKeyId: process.env.ACCESS_KEY || '',
        secretAccessKey: process.env.SECRET_KEY || '', 
        sessionToken: process.env.SESSION_TOKEN || '', 
        region: process.env.REGION || '', 
    });

    const params: ListObjectsV2Request = {
        Bucket: process.env.NEXT_PUBLIC_BUCKET_NAME,
        Prefix: '', 
        Delimiter: '', 
    };

    try {
        let allFiles: ObjectList = [];
        let isTruncated: boolean = true;
        let ContinuationToken: string | undefined;

        while (isTruncated) {
            const data: ListObjectsV2Output = await s3.listObjectsV2({
                ...params,
                ContinuationToken
            }).promise();

            allFiles = allFiles.concat(data.Contents || []);
            isTruncated = data.IsTruncated || false;
            ContinuationToken = data.NextContinuationToken;
        }

        if (allFiles.length > 0) {
            allFiles.sort((a, b) => {
                if (!a.LastModified || !b.LastModified) return 0;
                return b.LastModified.getTime() - a.LastModified.getTime();
            });
            const latestFileKey: string | undefined = allFiles[0].Key; 
            if (latestFileKey) {
                return res.status(200).json({ key: latestFileKey });
            } else {
                return res.status(404).json({ error: 'No files found in the bucket' });
            }
        } else {
            return res.status(404).json({ error: 'No files found in the bucket' });
        }
    } catch (error) {
        console.error('Error retrieving latest file key:', error);
        return res.status(500).json({ error: 'Error retrieving latest file key' });
    }
}
