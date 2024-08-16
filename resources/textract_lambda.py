import json
import boto3
from botocore.exceptions import NoCredentialsError, PartialCredentialsError, ClientError
from urllib.parse import unquote_plus

def lambda_handler(event, context):
    try:
        textract = boto3.client('textract', region_name='us-east-1') 
      
        bucket = event['Records'][0]['s3']['bucket']['name']
        document = unquote_plus(event['Records'][0]['s3']['object']['key'])

        print(f"Bucket: {bucket}, Document: {document}")
   
        response = textract.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': bucket,
                    'Name': document
                }
            }
        )
     
        text = ''
        for item in response['Blocks']:
            if item['BlockType'] == 'LINE':
                text += item['Text'] + '\n'
        
        print("Extracted text:")
        print(text)

        return {
            'statusCode': 200,
            'body': json.dumps(text)
        }
    
    except NoCredentialsError:
        print("Credentials not available.")
        return {
            'statusCode': 500,
            'body': json.dumps("Credentials not available.")
        }
    except PartialCredentialsError:
        print("Incomplete credentials.")
        return {
            'statusCode': 500,
            'body': json.dumps("Incomplete credentials.")
        }
    except ClientError as e:
        print(f"ClientError: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"ClientError: {str(e)}")
        }
    except KeyError as e:
        print(f"KeyError: {str(e)} - Check the event structure.")
        return {
            'statusCode': 400,
            'body': json.dumps(f"KeyError: {str(e)} - Check the event structure.")
        }
    except Exception as e:
        print(f"Exception: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Exception: {str(e)}")
        }