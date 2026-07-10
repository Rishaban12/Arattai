package com.arattai.web.media;

import com.arattai.config.Env;
import com.arattai.dto.media.MediaUploadResponse;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.file.Files;
import java.util.UUID;

@MultipartConfig(maxFileSize = 50 * 1024 * 1024L) // 50 MB
public class MediaUploadServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(MediaUploadServlet.class);

    // Local disk directory for when MinIO / S3 is not available
    private static final File LOCAL_DIR = new File(
            System.getProperty("user.home"), "arattai-media");

    private S3Client s3;

    @Override
    public void init() {
        LOCAL_DIR.mkdirs();
        String endpoint  = Env.get("S3_ENDPOINT");
        String accessKey = Env.get("S3_KEY");
        String secretKey = Env.get("S3_SECRET");
        if (endpoint != null && !endpoint.isBlank()
                && accessKey != null && !accessKey.isBlank()
                && secretKey != null && !secretKey.isBlank()) {
            try {
                s3 = S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .credentialsProvider(StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)))
                        .region(Region.US_EAST_1)
                        .forcePathStyle(true)
                        .build();
                log.info("MediaUploadServlet: S3/MinIO configured at {}", endpoint);
            } catch (Exception e) {
                log.warn("MediaUploadServlet: S3 init failed, will use local disk: {}", e.getMessage());
                s3 = null;
            }
        } else {
            log.info("MediaUploadServlet: S3 not configured, using local disk at {}", LOCAL_DIR);
        }
    }

    /** POST /api/media — upload a file, return its public URL */
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
        String key         = UUID.randomUUID() + extensionFor(contentType);
        String mediaUrl;

        if (s3 != null) {
            try {
                mediaUrl = uploadToS3(key, contentType, size, filePart);
            } catch (Exception e) {
                log.warn("S3 upload failed, falling back to local disk: {}", e.getMessage());
                mediaUrl = saveLocally(key, filePart, req);
            }
        } else {
            mediaUrl = saveLocally(key, filePart, req);
        }

        Servlets.created(res, new MediaUploadResponse(mediaUrl, contentType, size));
    }

    /** GET /api/media/{key} — serve a locally-stored file */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        String pathInfo = req.getPathInfo(); // "/{key}"
        if (pathInfo == null || pathInfo.length() <= 1) {
            Servlets.error(res, 400, "Missing file key");
            return;
        }
        String key  = pathInfo.substring(1); // strip leading /
        File   file = new File(LOCAL_DIR, key);

        if (!file.getCanonicalPath().startsWith(LOCAL_DIR.getCanonicalPath())
                || !file.exists() || !file.isFile()) {
            Servlets.error(res, 404, "Not found");
            return;
        }

        String mime = Files.probeContentType(file.toPath());
        if (mime == null) mime = "application/octet-stream";
        res.setContentType(mime);
        res.setContentLengthLong(file.length());
        res.setHeader("Cache-Control", "public, max-age=31536000");
        try (OutputStream out = res.getOutputStream()) {
            Files.copy(file.toPath(), out);
        }
    }

    private String uploadToS3(String key, String contentType, long size, Part filePart) throws Exception {
        String bucket = Env.get("S3_BUCKET");
        String s3Key  = "media/" + key;
        try (InputStream in = filePart.getInputStream()) {
            PutObjectRequest put = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(s3Key)
                    .contentType(contentType)
                    .build();
            s3.putObject(put, RequestBody.fromInputStream(in, size));
        }
        return Env.get("S3_ENDPOINT") + "/" + bucket + "/" + s3Key;
    }

    private String saveLocally(String key, Part filePart, HttpServletRequest req) throws IOException {
        File dest = new File(LOCAL_DIR, key);
        try (InputStream in = filePart.getInputStream()) {
            Files.copy(in, dest.toPath());
        }
        // Build an absolute URL back to this servlet's GET handler
        String scheme = req.getScheme();
        String host   = req.getServerName();
        int    port   = req.getServerPort();
        String portStr = (port == 80 || port == 443) ? "" : ":" + port;
        return scheme + "://" + host + portStr + "/api/media/" + key;
    }

    private String extensionFor(String contentType) {
        if (contentType == null) return "";
        return switch (contentType) {
            case "image/jpeg"       -> ".jpg";
            case "image/png"        -> ".png";
            case "image/gif"        -> ".gif";
            case "image/webp"       -> ".webp";
            case "application/pdf"  -> ".pdf";
            case "video/mp4"        -> ".mp4";
            case "audio/mpeg"       -> ".mp3";
            default                 -> "";
        };
    }
}