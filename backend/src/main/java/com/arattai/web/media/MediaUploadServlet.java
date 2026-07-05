package com.arattai.web.media;

import com.arattai.dto.media.MediaUploadResponse;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.UUID;

@MultipartConfig(maxFileSize = 50 * 1024 * 1024L) // 50 MB
public class MediaUploadServlet extends HttpServlet {

    private static final String BUCKET     = System.getenv("S3_BUCKET");
    private static final String ENDPOINT   = System.getenv("S3_ENDPOINT");
    private static final String ACCESS_KEY = System.getenv("S3_KEY");
    private static final String SECRET_KEY = System.getenv("S3_SECRET");

    private S3Client s3;

    @Override
    public void init() {
        s3 = S3Client.builder()
                .endpointOverride(URI.create(ENDPOINT != null ? ENDPOINT : "https://s3.amazonaws.com"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(ACCESS_KEY, SECRET_KEY)))
                .region(Region.US_EAST_1)
                .forcePathStyle(true)   // required for MinIO
                .build();
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        Part filePart = req.getPart("file");
        if (filePart == null) {
            Servlets.error(res, 400, "No file part in request");
            return;
        }

        String contentType = filePart.getContentType();
        long   size        = filePart.getSize();
        String ext         = extensionFor(contentType);
        String key         = "media/" + UUID.randomUUID() + ext;

        try (InputStream in = filePart.getInputStream()) {
            PutObjectRequest put = PutObjectRequest.builder()
                    .bucket(BUCKET)
                    .key(key)
                    .contentType(contentType)
                    .build();
            s3.putObject(put, RequestBody.fromInputStream(in, size));
        }

        String mediaUrl = ENDPOINT + "/" + BUCKET + "/" + key;
        Servlets.created(res, new MediaUploadResponse(mediaUrl, contentType, size));
    }

    private String extensionFor(String contentType) {
        if (contentType == null) return "";
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png"  -> ".png";
            case "image/gif"  -> ".gif";
            case "image/webp" -> ".webp";
            case "video/mp4"  -> ".mp4";
            case "audio/mpeg" -> ".mp3";
            default           -> "";
        };
    }
}
