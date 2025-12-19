import logging
import sys
from datetime import datetime
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Configure root logger
def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure application logging."""
    
    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    # Console handler (Docker captures stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    root_logger.addHandler(console_handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    
    return logging.getLogger("app")


def get_logger(name: str) -> logging.Logger:
    """Get a logger for a specific module."""
    return logging.getLogger(f"app.{name}")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all incoming requests and responses."""
    
    def __init__(self, app, logger: logging.Logger):
        super().__init__(app)
        self.logger = logger
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = datetime.now()
        
        # Log request
        self.logger.info(
            f"→ {request.method} {request.url.path}"
            f"{('?' + str(request.query_params)) if request.query_params else ''}"
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (datetime.now() - start_time).total_seconds() * 1000
            
            # Log response
            self.logger.info(
                f"← {request.method} {request.url.path} "
                f"| {response.status_code} | {duration_ms:.1f}ms"
            )
            
            return response
            
        except Exception as e:
            duration_ms = (datetime.now() - start_time).total_seconds() * 1000
            self.logger.exception(
                f"✗ {request.method} {request.url.path} "
                f"| ERROR | {duration_ms:.1f}ms | {str(e)}"
            )
            raise
