from argparse import OPTIONAL
from enum import Enum
from threading import TIMEOUT_MAX
from time import time_ns
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, HttpUrl

## Define Enum for MediaType with
## Enum: "image/jpeg" "image/png" "image/webp" "image/vnd.adobe.photoshop"


class MediaType(str, Enum):
    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"
    PHOTOSHOP = "image/vnd.adobe.photoshop"


class ContentClass(str, Enum):
    PHOTO = "photo"
    ART = "art"


class HorizontalPosition(str, Enum):
    CENTER = "center"
    LEFT = "left"
    RIGHT = "right"


class VerticlePosition(str, Enum):
    CENTER = "center"
    TOP = "top"
    BOTTOM = "bottom"


class LoopType(str, Enum):
    NONE = "none"
    STOP_ON_LAST_FRAME = "stop_on_last_frame"
    LOOP = "loop"
    TIME_STRETCH = "time_stretch"


class MediaFormat(str, Enum):
    NONE = "none"
    MP4 = "mp4"
    MOV = "mov"
    SOURCE = "source"


class MediaSidecar(str, Enum):
    JSON = "json"
    OTIO = "otio"


class Position(BaseModel):
    horizontal: HorizontalPosition
    vertical: VerticlePosition


class Alignment(BaseModel):
    horizontal: HorizontalPosition
    vertical: VerticlePosition


class AspectRatio(BaseModel):
    x: int = Field(gt=0)
    y: int = Field(gt=0)


class Inset(BaseModel):
    bottom: int
    left: int
    right: int
    top: int


class Placement(BaseModel):
    alignment: Alignment
    inset: Inset


class ImageSource(BaseModel):
    url: str


class ImageInput(BaseModel):
    source: ImageSource


class ImageSize(BaseModel):
    width: int
    height: int


class ExistingImage(BaseModel):
    image: ImageInput
    numVariations: int
    seeds: list[int]
    size: ImageSize


class GenericResponse(BaseModel):
    cancelUrl: str | None
    jobId: str
    statusUrl: str


class SimpleResponse(BaseModel):
    jobId: str
    statusUrl: str


class PhostoshopRemoveBackgroundRequest(BaseModel):
    image: ImageInput
    mode: str = "cutout"
    output: dict = {"mediaType": MediaType.JPEG}
    trim: bool = False
    backgroundColor: dict = {"red": 255, "green": 255, "blue": 255, "alpha": 1}
    colorDecontamination: int = 1


class ScriptFromText(BaseModel):
    text: str = ""
    mediaType: str = "text/plain"
    localeCode: str = "en-US"


class AudioFromText(BaseModel):
    script: ScriptFromText
    voiceId: str
    output: dict = {"mediaType": "audio/wav"}


class AvatarVideoRequest(BaseModel):
    script: ScriptFromText
    voiceId: str
    avatarId: str
    output: dict = {"mediaType": "video/mp4"}


class VideoSource(BaseModel):
    url: str


class Scale(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class ReframePosition(BaseModel):
    anchorPoint: Literal[
        "top_left",
        "top_center",
        "top_right",
        "center_left",
        "center",
        "center_right",
        "bottom_left",
        "bottom_center",
        "bottom_right",
    ]
    offsetX: int
    offsetY: int


class VideoInput(BaseModel):
    source: VideoSource
    mediaType: str = "video/mp4"


class VideoDubRequest(BaseModel):
    video: VideoInput
    targetLocaleCodes: list[str]
    lipSync: bool = True


class VideoReframeRequest(BaseModel):
    source: VideoSource


class ReframeOverlay(BaseModel):
    source: VideoSource
    startTime: str
    duration: str
    scale: Scale
    position: ReframePosition
    # loop: LoopType | None = None


class ReframeAnalysis(BaseModel):
    sceneEditDetection: bool
    focalPoints: list[str] | None = None


class ReframeFormat(BaseModel):
    media: MediaFormat
    sidecar: MediaSidecar | None = None


class ReframeReditions(BaseModel):
    aspectRatio: AspectRatio
    mediaDestination: VideoSource
    sidecarDestination: VideoSource | None = None


class ReframeOutput(BaseModel):
    format: ReframeFormat
    renditions: list[ReframeReditions]


class ReframeOverlays(BaseModel):
    overlays: list[ReframeOverlay]


class ReframeRequest(BaseModel):
    video: VideoReframeRequest
    analysis: ReframeAnalysis
    composition: ReframeOverlays
    output: ReframeOutput


class ObjectCompositeRequest(BaseModel):
    contentClass: ContentClass
    image: ImageInput
    mask: ImageInput
    numVariations: int = 1
    placement: Placement
    prompt: str
    seeds: list[int]
    size: ImageSize


class Video(BaseModel):
    source: VideoSource


class Analysis(BaseModel):
    sceneEditDetection: bool = Field(default=True)
    focalPoints: List[dict] = Field(default_factory=list)


class OverlaySource(BaseModel):
    url: HttpUrl


class Overlay(BaseModel):
    source: OverlaySource
    startTime: str = Field(pattern=r"^\d{2}:\d{2}:\d{2}:\d{2}$")
    duration: str = Field(pattern=r"^\d{2}:\d{2}:\d{2}:\d{2}$")
    scale: Scale
    position: Position
    repeat: Literal["loop", "once"] = "loop"


class Composition(BaseModel):
    overlays: List[Overlay] = Field(default_factory=list)


class OutputFormat(BaseModel):
    media: Literal["mp4"] = "mp4"


class MediaDestination(BaseModel):
    url: HttpUrl


class Rendition(BaseModel):
    aspectRatio: AspectRatio
    mediaDestination: Optional[MediaDestination] = None


class Output(BaseModel):
    format: OutputFormat = Field(default_factory=OutputFormat)
    renditions: List[Rendition]


class VideoReframingRequest(BaseModel):
    video: Video
    analysis: Optional[Analysis] = Field(default_factory=Analysis)
    composition: Optional[Composition] = None
    output: Output


class PositionItem(BaseModel):
    position: int


class ConditionsItem(BaseModel):
    placement: PositionItem
    source: ImageSource


class Conditions(BaseModel):
    conditions: List[ConditionsItem] = None


class VideoSettingsItem(BaseModel):
    cameraMotion: str
    promptStyle: str
    shotAngle: str
    shotSize: str


class VideoFromTextPayloadExample(BaseModel):
    bitRateFactor: int = 18
    image: Conditions
    prompt: str
    seeds: List[int]
    sizes: List[Scale]
    videoSettings: VideoSettingsItem


class PhotoDestination(BaseModel):
    href: str
    storage: str = "external"
    type: str | None = "image/jpeg"
    overwrite: bool | None = Field(None, exclude=True)
    quality: int | None = Field(None, exclude=True)
    compression: str | None = Field(None, exclude=True)


class SizeOptions(BaseModel):
    unit: str = "Pixels"
    width: int
    height: int


class ProductCrop(BaseModel):
    inputs: List[PhotoDestination]
    outputs: List[PhotoDestination]
    options: SizeOptions


class AutoToneParams(BaseModel):
    inputs: PhotoDestination
    outputs: List[PhotoDestination]


class LightroomSelf(BaseModel):
    href: str


class LightroomLinks(BaseModel):
    self: LightroomSelf


class LightroomResponse(BaseModel):
    _links: LightroomLinks
    # external_link: str | None = None


class ExpandImageResponse(BaseModel):
    imageId: str
    width: int
    height: int
