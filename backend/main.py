import os
import time

import dotenv
import pydantic
import requests
from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware

from aws import generate_presigned_url, read_s3_contents
from logging_config import RequestLoggingMiddleware, setup_logging
from serializers import (
    AudioFromText,
    AutoToneParams,
    AvatarVideoRequest,
    ExistingImage,
    ExpandImageResponse,
    GenericResponse,
    LightroomResponse,
    ObjectCompositeRequest,
    PhostoshopRemoveBackgroundRequest,
    ProductCrop,
    ReframeRequest,
    SimpleResponse,
    VideoDubRequest,
    VideoFromTextPayloadExample,
)

# Initialize logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logger = setup_logging(level=LOG_LEVEL)
logger.info("Application starting up")

app = FastAPI(title="Firefly API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Access-Control-Allow-Origin"],
)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware, logger=logger)

config = dotenv.load_dotenv()
client_id = os.getenv("FIREFLY_SERVICES_CLIENT_ID")
client_secret = os.getenv("FIREFLY_SERVICES_CLIENT_SECRET")
scopes = os.getenv("SCOPES")
fetch_count = 0
token_data = {}


supported_sizes = [
    (2688, 1536),
    (1344, 756),
    (896, 1152),
    (1344, 768),
    (2688, 1512),
    (2304, 1792),
    (1152, 896),
    (2048, 2048),
    (1792, 2304),
    (1024, 1024),
]


@app.post("/generate-access-token")
def retrieve_access_token(response: Response = Response()):
    token_url = "https://ims-na1.adobelogin.com/ims/token/v3"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": scopes,
    }

    res = requests.post(token_url, data=payload)
    res.raise_for_status()
    token_data = res.json()
    response.set_cookie(
        key="access_token",
        value=token_data["access_token"],
        httponly=True,
        max_age=token_data["expires_in"],
    )
    response.set_cookie(
        key="token_type",
        value=token_data["token_type"],
        httponly=True,
        max_age=token_data["expires_in"],
    )
    logger.info("Access Token Retrieved")
    return token_data


@app.post("/generate-image-async")
def generate_image(prompt: str, reference_image: str, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
        "x-model-version": "image3",
    }

    data = {
        "prompt": prompt,
        "style": {"strength": 100, "imageReference": {"url": reference_image}},
    }
    try:
        response = requests.post(
            "https://firefly-api.adobe.io/v3/images/generate-async",
            headers=headers,
            json=data,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    logger.info(f"Response {response}")
    response.raise_for_status()
    return response.json()


@app.post("/generate-object-composite")
def generate_object_composite(
    incoming_request: ObjectCompositeRequest, request: Request
):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
        "x-model-version": "image3",
    }

    data = incoming_request.model_dump()
    try:
        response = requests.post(
            "https://firefly-api.adobe.io/v3/images/generate-object-composite-async",
            headers=headers,
            json=data,
        )
    except Exception as e:
        logger.error(f"Error generating object composite: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    response.raise_for_status()
    return response.json()


def fetch_image(access_token, statusUrl):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }
    response = requests.get(statusUrl, headers=headers)
    response.raise_for_status()
    image_response = response.json()
    return image_response


@app.get("/complete-image-callback")
def success_image_callback(statusUrl, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    global fetch_count
    status = ""
    while status != "succeeded" and status != "failed":
        fetch_count += 1
        retrieved_image = fetch_image(access_token, statusUrl)
        if "status" in retrieved_image:
            status = retrieved_image["status"]
        elif "status" in retrieved_image["outputs"][0]:
            status = retrieved_image["outputs"][0]["status"]

        if status != "succeeded" and status != "failed":
            sleep_time = 2**fetch_count
            time.sleep(sleep_time)
        else:
            logger.info("Image generation:", retrieved_image)
            return retrieved_image


@app.get("/check-status")
def check_image_status(job_id, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    statusUrl = f"https://firefly-api.adobe.io/v3/status/{job_id}"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }
    response = requests.get(statusUrl, headers=headers)
    response.raise_for_status()
    return response.json()


@app.put("/cancel-job")
def cancel_image_job(job_id, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    statusUrl = f"https://firefly-api.adobe.io/v3/status/{job_id}/cancel"
    headers = {"x-api-key": client_id, "Authorization": f"Bearer {access_token}"}
    response = requests.put(statusUrl, headers=headers)
    response.raise_for_status()
    return response.json()


@app.post("/image-upload")
async def upload_image(request: Request, file: UploadFile = File(...)):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    try:
        headers = {
            "Content-Type": file.content_type,
            "Authorization": f"Bearer {access_token}",
            "x-api-key": client_id,
        }
        file_content_bytes = await file.read()
        logger.info(f"Upload file type : {type(file_content_bytes)}")
        response = requests.post(
            "https://firefly-api.adobe.io/v2/storage/image",
            headers=headers,
            data=file_content_bytes,
        )
        if not response.ok:
            logger.error(f"Image UploadError response: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return {"filename": file.filename, "firefly_response": response.json()}
    except Exception as e:
        logger.error(f"Image UploadError: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/expand-image-async")
def expand_image_async(expand_request: ExpandImageResponse, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    try:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": client_id,
            "Authorization": f"Bearer {access_token}",
        }
        data = {
            "image": {"source": {"uploadId": expand_request.imageId}},
            "size": {
                "width": expand_request.width,
                "height": expand_request.height,
            },
        }
        response = requests.post(
            "https://firefly-api.adobe.io/v3/images/expand-async",
            headers=headers,
            json=data,
        )
        image_request = response.json()
        return image_request
    except Exception as e:
        logger.error(f"Error submitting expand image job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/expand-image-all-sizes")
def expand_image_for_all_sizes(imageId: str, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    responses = []
    for size in supported_sizes:
        expand_request = ExpandImageResponse(
            imageId=imageId, width=size[0], height=size[1]
        )
        responses.append(
            expand_image_async(expand_request=expand_request, request=request)
        )
    return responses


@app.post("/generate-similar-async")
def generate_similar_async(existingImage: ExistingImage, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }
    try:
        response = requests.post(
            "https://firefly-api.adobe.io/v3/images/generate-similar-async",
            headers=headers,
            json=existingImage.model_dump(),
        )
        response.raise_for_status()
        image_request: GenericResponse = response.json()
        return image_request
    except Exception as e:
        logger.error(f"Error generating similar image: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate similar image")


@app.get("/list-custom-models")
def list_custom_models(limit_val: str, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
        "x-request-id": "mb123",
    }

    try:
        response = requests.get(
            f"https://firefly-api.adobe.io/v3/custom-models?sortBy=assetName&start=0&limit={limit_val}&publishedState=all",
            headers=headers,
        )
        response.raise_for_status()
        models = response.json()
        return models
    except Exception as e:
        logger.error(f"Error listing custom models: {e}")
        raise HTTPException(status_code=500, detail="Failed to list custom models")


@app.post("/generate-video-from-text")
def generate_video_from_text(textParams: VideoFromTextPayloadExample, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "Content-Type": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
        "x-model-version": "video1_standard",
    }

    data = textParams.model_dump()
    try:
        response = requests.post(
            "https://firefly-api.adobe.io/v3/videos/generate",
            headers=headers,
            json=data,
        )
        video_request: SimpleResponse = response.json()
        return video_request
    except Exception as e:
        logger.error(f"Error generating video from text: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to generate video from text"
        )


@app.post("/remove-background-async")
def remove_background_photoshop_async(
    backgroundRemoveRequest: PhostoshopRemoveBackgroundRequest, request: Request
):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }
    try:
        response = requests.post(
            "https://image.adobe.io/v2/remove-background",
            headers=headers,
            json=backgroundRemoveRequest.model_dump(),
        )
        response.raise_for_status()
        image_request: GenericResponse = response.json()
        return image_request
    except Exception as e:
        logger.error(f"Error removing background from image: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to remove background from image"
        )


@app.post("/crop-image")
def crop_image(crop_request: ProductCrop, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        access_token = retrieve_access_token()
        logger.error("Access token is missing or expired.")
        if not access_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
        logger.info("Access token retrieved")

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }
    payload = crop_request.model_dump(exclude_none=True)

    try:
        response = requests.post(
            "https://image.adobe.io/pie/psdService/productCrop",
            headers=headers,
            json=payload,
        )
        print(f"Response {response.json()}")
        # response.raise_for_status()
        image_request: GenericResponse = response.json()
        print("Photoshop Crop Image Job Submitted:", image_request)
        return image_request
    except pydantic.ValidationError as e:
        print(f"Validation error occurred while cropping image: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid input data. {e}")
    except requests.exceptions.RequestException as e:
        print(f"Error occurred while cropping image: {e}")
        raise HTTPException(status_code=500, detail="Failed to crop image.")


@app.get("/get-psd-status/{job_id}")
def get_psd_status(job_id: str, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    headers = {"x-api-key": client_id, "Authorization": f"Bearer {access_token}"}

    try:
        response = requests.get(
            f"https://image.adobe.io/pie/psdService/status/{job_id}",
            headers=headers,
        )
        response.raise_for_status()
        status = response.json()
        return status
    except requests.exceptions.RequestException as e:
        logger.error(f"Error occurred while getting PSD status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get PSD status.")


@app.get("/available-voices")
def get_available_voices(request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {"x-api-key": client_id, "Authorization": f"Bearer {access_token}"}

    try:
        response = requests.get(
            "https://audio-video-api.adobe.io/v1/voices", headers=headers
        )
        response.raise_for_status()
        voices = response.json()
        return voices
    except requests.exceptions.RequestException as e:
        logger.error(f"Error occurred while getting available voices: {e}")
        raise HTTPException(status_code=500, detail="Failed to get available voices.")


@app.get("/available-avatars")
def get_available_avatars(request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {"x-api-key": client_id, "Authorization": f"Bearer {access_token}"}

    try:
        response = requests.get(
            "https://audio-video-api.adobe.io/v1/avatars", headers=headers
        )
        response.raise_for_status()
        avatars = response.json()
        return avatars
    except requests.exceptions.RequestException as e:
        logger.error(f"Error occurred while getting available avatars: {e}")
        raise HTTPException(status_code=500, detail="Failed to get available avatars.")


@app.post("/generate-avatar-video")
def generate_avatar_video(videoParams: AvatarVideoRequest, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "Content-Type": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }

    data = {
        "avatarId": videoParams.avatarId,
        "voiceId": videoParams.voiceId,
        "script": videoParams.script.model_dump(),
        "output": videoParams.output,
    }

    try:
        response = requests.post(
            "https://audio-video-api.adobe.io/v1/generate-avatar",
            headers=headers,
            json=data,
        )
        response.raise_for_status()
        video_request: SimpleResponse = response.json()
        return video_request
    except requests.exceptions.RequestException as e:
        logger.error(f"Error occurred while generating avatar video: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate avatar video.")


@app.post("/generate-audio-from-text")
def generate_audio_from_text(audioParams: AudioFromText, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "Content-Type": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }

    data = {
        "script": audioParams.script.model_dump(),
        "voiceId": audioParams.voiceId,
        "output": audioParams.output,
    }
    try:
        response = requests.post(
            "https://audio-video-api.adobe.io/v1/generate-speech",
            headers=headers,
            json=data,
        )
        response.raise_for_status()
        audio_request: SimpleResponse = response.json()
        return audio_request
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate audio")


@app.post("/dub-video")
def dub_video(dubParams: VideoDubRequest, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )

    headers = {
        "Content-Type": "application/json",
        "x-api-key": client_id,
        "Authorization": f"Bearer {access_token}",
    }

    data = {
        "video": dubParams.video.model_dump(),
        "targetLocaleCodes": dubParams.targetLocaleCodes,
        "lipSync": dubParams.lipSync,
    }
    try:
        response = requests.post(
            "https://audio-video-api.adobe.io/v1/dub", headers=headers, json=data
        )
        response.raise_for_status()
        dub_request: SimpleResponse = response.json()
        return dub_request
    except Exception as e:
        logger.error(f"Error occurred while dubbing video: {e}")
        raise HTTPException(status_code=500, detail="Failed to dub video")


@app.post("/reframe-video")
def reframe_video(reframe_params: ReframeRequest, request: Request):
    try:
        access_token = request.cookies.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=401, detail="Access token is missing or expired."
            )

        headers = {
            "Content-Type": "application/json",
            "x-api-key": client_id,
            "Authorization": f"Bearer {access_token}",
        }
        payload = reframe_params.model_dump(exclude_none=True)

        response = requests.post(
            "https://audio-video-api.adobe.io/v2/reframe",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        reframe_request: SimpleResponse = response.json()
        return reframe_request
    except Exception as e:
        logger.error(f"Error occurred while reframing video: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/check-audio-video-status")
def check_audio_video_status(job_id: str, request: Request):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=401, detail="Access token is missing or expired."
        )
    try:
        headers = {"x-api-key": client_id, "Authorization": f"Bearer {access_token}"}
        statusUrl = f"https://audio-video-api.adobe.io/v2/status/{job_id}"
        response = requests.get(statusUrl, headers=headers)
        response.raise_for_status()
        status_response = response.json()
        return status_response
    except Exception as e:
        logger.error(f"Error occurred while checking audio/video status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auto-tone")
async def auto_tone(auto_tone_params: AutoToneParams, request: Request):
    try:
        access_token = request.cookies.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=401, detail="Access token is missing or expired."
            )

        headers = {
            "Content-Type": "application/json",
            "x-api-key": client_id,
            "Authorization": f"Bearer {access_token}",
        }

        data = auto_tone_params.model_dump(exclude_none=True)
        response = requests.post(
            "https://image.adobe.io/lrService/autoTone", headers=headers, json=data
        )
        response.raise_for_status()
        auto_tone_response: LightroomResponse = response.json()
        return auto_tone_response
    except Exception as e:
        logger.error(f"Error auto tone job: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to submit auto tone job. {e}"
        )


@app.get("/lightroom-status")
def get_lightroom_status(job_id: str, request: Request):
    try:
        access_token = request.cookies.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=401, detail="Access token is missing or expired."
            )

        headers = {
            "Content-Type": "application/json",
            "x-api-key": client_id,
            "Authorization": f"Bearer {access_token}",
        }
        response = requests.get(
            f"https://image.adobe.io/lrService/status/{job_id}", headers=headers
        )
        logger.info(f"Lightroom Status Response {response}")
        response.raise_for_status()
        status = response.json()
        return status
    except Exception as e:
        logger.error(f"Error getting Lightroom status: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get Lightroom status. {e}"
        )


@app.get("/get-s3-thumbnails")
def get_s3_thumbnails(bucket_name: str, prefix: str, request: Request):
    thumbnail_urls = []
    try:
        files = read_s3_contents(bucket_name, prefix)
        if files:
            for file in files:
                thumbnail_url, name = generate_presigned_url(
                    bucket_name=bucket_name, key=file
                )
                if thumbnail_url:
                    thumbnail_urls.append((thumbnail_url, name))
        return thumbnail_urls
    except Exception as e:
        logger.error(f"Error reading S3 contents: {e}")
        raise HTTPException(status_code=500, detail="Failed to read S3 contents.")


@app.get("/proxy-s3-image")
async def proxy_s3_image(image_name: str):
    """Fetch image from S3 and return as binary response"""
    import boto3
    from fastapi.responses import Response

    try:
        s3 = boto3.client("s3")
        bucket_name = "firefly-images-demo-bucket"

        # Fetch from S3
        response = s3.get_object(Bucket=bucket_name, Key=image_name)
        image_data = response["Body"].read()
        content_type = response.get("ContentType", "image/png")

        return Response(
            content=image_data,
            media_type=content_type,
            headers={"Content-Disposition": f"inline; filename={image_name}"},
        )
    except Exception as e:
        logger.error(f"Error proxying S3 contents: {e}")
        raise HTTPException(status_code=500, detail="Failed to read S3 contents.")


@app.get("/get-s3-presigned-url")
def get_s3_presigned_url(bucket_name: str, key: str, method: str, request: Request):
    method = method if method == "put_object" else "get_object"
    try:
        url = generate_presigned_url(bucket_name=bucket_name, key=key, method=method)
        return {"url": url}
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate presigned URL.")


@app.get("/get-s3-video-names")
def get_s3_video_names(bucket_name: str, prefix: str, request: Request):
    video_names = []
    try:
        files = read_s3_contents(bucket_name, prefix)
        if files:
            for file in files:
                if file.endswith(".mp4"):
                    video_names.append(file)
        return video_names
    except Exception as e:
        logger.error(f"Error reading S3 contents: {e}")
        raise HTTPException(status_code=500, detail="Failed to read S3 contents.")
