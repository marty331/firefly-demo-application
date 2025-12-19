import io
import os

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from PIL import Image

from logging_config import setup_logging

# Initialize logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logger = setup_logging(level=LOG_LEVEL)
logger.info("Application starting up")

load_dotenv()
thumbnail_size = (128, 128)


def generate_presigned_url(
    bucket_name: str, key: str, method="get_object", expires_in=3600 * 12
):
    """
    Generate a presigned Amazon S3 URL that can be used to perform an action.
    """
    s3_client = boto3.client(
        "s3", region_name="us-east-1", config=Config(signature_version="s3v4")
    )
    try:
        key = f"altered/{key}" if method == "put_object" else key
        url = s3_client.generate_presigned_url(
            ClientMethod=method,
            Params={
                "Bucket": bucket_name,
                "Key": key,
                # "ContentType": "image/png",  # Specify content type
            },
            ExpiresIn=expires_in,
        )
        return url, key.replace("thumbnails/", "")
    except ClientError:
        logger.error("Couldn't get a presigned URL for client method put_object.")
        raise


def generate_thumbnail_images(bucket_name: str):
    """
    Generate a presigned Amazon S3 URL that can be used to perform an action.

    :param s3_client: A Boto3 Amazon S3 client.
    :param method_parameters: The parameters of the specified client method.
    :param expires_in: The number of seconds the presigned URL is valid for.
    :return: The presigned URL.
    """
    s3_client = boto3.client(
        "s3", region_name="us-east-1", config=Config(signature_version="s3v4")
    )
    response = s3_client.list_objects_v2(Bucket=bucket_name)
    if "Contents" in response:
        for obj in response["Contents"]:
            key = obj["Key"]
            # Filter for image files (e.g., .jpg, .png)
            if key.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp")):
                try:
                    # Get the image object from S3
                    image_object = s3_client.get_object(Bucket=bucket_name, Key=key)
                    image_data = image_object["Body"].read()

                    # Open the image using Pillow
                    image = Image.open(io.BytesIO(image_data))

                    # Create a thumbnail
                    image.thumbnail(thumbnail_size)

                    # You can now process the thumbnail (e.g., save it, upload to S3)
                    # Example: Save thumbnail to a BytesIO object for re-upload
                    thumbnail_buffer = io.BytesIO()
                    image.save(thumbnail_buffer, format=image.format)
                    thumbnail_buffer.seek(0)

                    # Example: Upload the thumbnail back to S3 with a new key
                    thumbnail_key = f"thumbnails/{key}"  # Or modify the existing key
                    s3_client.put_object(
                        Bucket=bucket_name,
                        Key=thumbnail_key,
                        Body=thumbnail_buffer.getvalue(),
                        ContentType=f"image/{image.format.lower()}",
                    )

                except Exception as e:
                    logger.error(f"Error processing {key}: {e}")
        else:
            logger.info(f"No objects found in bucket: {bucket_name}")


def read_s3_contents(bucket_name: str, prefix="/"):
    s3_client = boto3.client(
        "s3", region_name="us-east-1", config=Config(signature_version="s3v4")
    )
    files = []
    try:
        # Get the object from S3
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
        for obj in response["Contents"]:
            files.append(obj["Key"])
        return files
    except Exception as e:
        logger.error(f"Error reading {bucket_name}: {e}")
        return None


def generate_video_names(bucket_name: str, prefix="/"):
    """
    Generate a presigned Amazon S3 URL that can be used to perform an action.

    :param s3_client: A Boto3 Amazon S3 client.
    :param method_parameters: The parameters of the specified client method.
    :param expires_in: The number of seconds the presigned URL is valid for.
    :return: The presigned URL.
    """
    s3_client = boto3.client(
        "s3", region_name="us-east-1", config=Config(signature_version="s3v4")
    )
    response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
    filenames = []
    if "Contents" in response:
        for obj in response["Contents"]:
            if obj["Key"].endswith(".mp4"):
                filenames.append(obj["Key"].split("/")[-1])
        else:
            logger.info(f"No objects found in bucket: {bucket_name}")
    return filenames
