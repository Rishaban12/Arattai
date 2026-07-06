package com.arattai.dto.media;

public class MediaUploadResponse {
    public String mediaUrl;
    public String contentType;
    public long   sizeBytes;

    public MediaUploadResponse(String mediaUrl, String contentType, long sizeBytes) {
        this.mediaUrl    = mediaUrl;
        this.contentType = contentType;
        this.sizeBytes   = sizeBytes;
    }
}