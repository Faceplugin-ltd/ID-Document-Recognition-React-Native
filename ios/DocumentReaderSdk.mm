#import "DocumentReaderSdk.h"
#import <UIKit/UIKit.h>

#if __has_include(<docsdk/DocSDK.h>)
#import <docsdk/DocSDK.h>
#define DRS_HAS_DOCSDK 1
#elif __has_include("DocSDK.h")
#import "DocSDK.h"
#define DRS_HAS_DOCSDK 1
#endif

@implementation DocumentReaderSdk
RCT_EXPORT_MODULE()

static void DRSWriteStatusFile(NSDictionary *payload) {
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  if (paths.count == 0) {
    return;
  }
  NSString *path = [paths[0] stringByAppendingPathComponent:@"docreader_status.json"];
  NSMutableDictionary *body = [payload mutableCopy] ?: [NSMutableDictionary dictionary];
  body[@"ts"] = @((long long)([[NSDate date] timeIntervalSince1970] * 1000.0));
  NSError *err = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:body options:NSJSONWritingPrettyPrinted error:&err];
  if (data == nil) {
    return;
  }
  [data writeToFile:path atomically:YES];
  NSLog(@"[DocReader] status file=%@ payload=%@", path, body);
}

static UIImage *DRSImageFromUriOrBase64(NSString *uriOrBase64) {
  if (uriOrBase64 == nil || uriOrBase64.length == 0) {
    return nil;
  }

  BOOL looksBase64 = [uriOrBase64 hasPrefix:@"data:"] ||
    ([uriOrBase64 length] > 256 &&
     [uriOrBase64 rangeOfString:@"://"].location == NSNotFound &&
     ![uriOrBase64 hasPrefix:@"/"] &&
     ![uriOrBase64 hasPrefix:@"file:"]);

  if (looksBase64) {
    NSString *payload = uriOrBase64;
    NSRange range = [uriOrBase64 rangeOfString:@"base64,"];
    if (range.location != NSNotFound) {
      payload = [uriOrBase64 substringFromIndex:range.location + range.length];
    }
    NSData *data = [[NSData alloc] initWithBase64EncodedString:payload options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (data == nil) {
      return nil;
    }
    return [UIImage imageWithData:data];
  }

  if ([uriOrBase64 hasPrefix:@"/"] || [uriOrBase64 hasPrefix:@"file:"]) {
    NSString *path = uriOrBase64;
    if ([path hasPrefix:@"file:"]) {
      NSURL *fileURL = [NSURL URLWithString:path];
      path = fileURL.path ?: path;
    }
    UIImage *fromFile = [UIImage imageWithContentsOfFile:path];
    if (fromFile != nil) {
      return fromFile;
    }
  }

  NSURL *url = [NSURL URLWithString:uriOrBase64];
  if (url == nil) {
    return nil;
  }
  NSData *data = [NSData dataWithContentsOfURL:url];
  if (data == nil) {
    return nil;
  }
  return [UIImage imageWithData:data];
}

static UIImage *DRSRedrawAtScale1(UIImage *image, CGSize pixelSize) {
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1;
  format.opaque = YES;
  UIGraphicsImageRenderer *renderer =
    [[UIGraphicsImageRenderer alloc] initWithSize:pixelSize format:format];
  return [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull ctx) {
    [image drawInRect:CGRectMake(0, 0, pixelSize.width, pixelSize.height)];
  }];
}

static UIImage *DRSFixOrientation(UIImage *image) {
  if (image == nil) {
    return nil;
  }
  if (image.imageOrientation == UIImageOrientationUp && image.scale == 1.0) {
    return image;
  }
  CGSize pixelSize = CGSizeMake(image.size.width * image.scale, image.size.height * image.scale);
  return DRSRedrawAtScale1(image, pixelSize);
}

/** Match native CameraViewController: landscape sensor buffer → portrait upright. */
static UIImage *DRSUprightCameraImage(UIImage *image) {
  if (image == nil) {
    return nil;
  }
  UIImage *oriented = image;
  CGFloat pw = image.size.width * image.scale;
  CGFloat ph = image.size.height * image.scale;
  if (pw > ph && image.imageOrientation == UIImageOrientationUp) {
    oriented = [UIImage imageWithCGImage:image.CGImage scale:1.0 orientation:UIImageOrientationRight];
  }
  return DRSFixOrientation(oriented);
}

static UIImage *DRSScaledMaxEdge(UIImage *image, CGFloat maxEdge) {
  if (image == nil) {
    return nil;
  }
  CGFloat pw = image.size.width * image.scale;
  CGFloat ph = image.size.height * image.scale;
  CGFloat longest = MAX(pw, ph);
  if (longest <= maxEdge || longest <= 0) {
    return image;
  }
  CGFloat factor = maxEdge / longest;
  CGSize newSize = CGSizeMake(MAX(1.0, pw * factor), MAX(1.0, ph * factor));
  return DRSRedrawAtScale1(image, newSize);
}

static NSString *DRSRescaleLocateJson(
  NSString *json,
  CGFloat locateW,
  CGFloat locateH,
  CGFloat imageW,
  CGFloat imageH
) {
  if (json.length == 0) {
    return json;
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id parsed = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if (![parsed isKindOfClass:[NSDictionary class]]) {
    return json;
  }
  NSMutableDictionary *root = [parsed mutableCopy];
  root[@"_locateImageWidth"] = @(imageW);
  root[@"_locateImageHeight"] = @(imageH);
  id posObj = root[@"position"];
  if (![posObj isKindOfClass:[NSDictionary class]]) {
    NSData *metaOnly = [NSJSONSerialization dataWithJSONObject:root options:0 error:nil];
    return metaOnly ? [[NSString alloc] initWithData:metaOnly encoding:NSUTF8StringEncoding] : json;
  }
  NSMutableDictionary *pos = [posObj mutableCopy];
  CGFloat sx = imageW / MAX(locateW, 1.0);
  CGFloat sy = imageH / MAX(locateH, 1.0);

  id corners = pos[@"corners"];
  if ([corners isKindOfClass:[NSArray class]]) {
    NSMutableArray *scaled = [NSMutableArray arrayWithCapacity:[corners count]];
    for (id item in corners) {
      if (![item isKindOfClass:[NSDictionary class]]) {
        continue;
      }
      NSDictionary *p = item;
      [scaled addObject:@{
        @"x": @([p[@"x"] doubleValue] * sx),
        @"y": @([p[@"y"] doubleValue] * sy),
      }];
    }
    pos[@"corners"] = scaled;
  } else {
    if (pos[@"left"] != nil) pos[@"left"] = @([pos[@"left"] doubleValue] * sx);
    if (pos[@"top"] != nil) pos[@"top"] = @([pos[@"top"] doubleValue] * sy);
    if (pos[@"right"] != nil) pos[@"right"] = @([pos[@"right"] doubleValue] * sx);
    if (pos[@"bottom"] != nil) pos[@"bottom"] = @([pos[@"bottom"] doubleValue] * sy);
  }
  root[@"position"] = pos;
  NSData *out = [NSJSONSerialization dataWithJSONObject:root options:0 error:nil];
  return out ? [[NSString alloc] initWithData:out encoding:NSUTF8StringEncoding] : json;
}

RCT_EXPORT_METHOD(getMachineCode:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    NSString *mc = [DocSDK getMachineCode] ?: @"";
    DRSWriteStatusFile(@{ @"step": @"getMachineCode", @"machine": mc });
    resolve(mc);
#else
    reject(@"E_SDK", @"docsdk.framework not linked. Drop frameworks into ios/Frameworks/.", nil);
#endif
  });
}

RCT_EXPORT_METHOD(setActivation:(NSString *)license
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    int code = [DocSDK setActivation:license];
    DRSWriteStatusFile(@{
      @"step": @"setActivation",
      @"code": @(code),
      @"licenseError": [DocSDK lastLicenseError] ?: @""
    });
    resolve(@(code));
#else
    reject(@"E_SDK", @"docsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(init:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    int code = [DocSDK initSDK];
    DRSWriteStatusFile(@{
      @"step": @"init",
      @"code": @(code),
      @"ready": @(code == 0),
      @"licenseError": [DocSDK lastLicenseError] ?: @""
    });
    if (code == 0) {
      NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
      NSString *docs = paths.firstObject;
      NSString *frontPath = [docs stringByAppendingPathComponent:@"smoke_front.png"];
      if ([[NSFileManager defaultManager] fileExistsAtPath:frontPath]) {
        UIImage *front = [UIImage imageWithContentsOfFile:frontPath];
        NSString *backPath = [docs stringByAppendingPathComponent:@"smoke_back.png"];
        UIImage *back = [[NSFileManager defaultManager] fileExistsAtPath:backPath]
          ? [UIImage imageWithContentsOfFile:backPath]
          : nil;
        if (front != nil) {
          [DocSDK startNewSession:@"{\"scenario\":\"FullProcess\",\"series\":false}"];
          NSString *json = [DocSDK recognizeFront:front back:back authenticity:YES] ?: @"";
          NSDictionary *parsed = nil;
          NSData *jdata = [json dataUsingEncoding:NSUTF8StringEncoding];
          if (jdata) {
            parsed = [NSJSONSerialization JSONObjectWithData:jdata options:0 error:nil];
          }
          NSDictionary *smoke = @{
            @"step": @"smokeRecognize",
            @"ready": @YES,
            @"errorCode": parsed[@"errorCode"] ?: [NSNull null],
            @"documentName": parsed[@"documentName"] ?: [NSNull null],
            @"countryName": parsed[@"countryName"] ?: [NSNull null],
            @"score": parsed[@"score"] ?: [NSNull null],
            @"jsonLen": @(json.length),
          };
          NSString *smokePath = [docs stringByAppendingPathComponent:@"docreader_smoke.json"];
          NSData *smokeData = [NSJSONSerialization dataWithJSONObject:smoke options:NSJSONWritingPrettyPrinted error:nil];
          [smokeData writeToFile:smokePath atomically:YES];
          NSLog(@"[DocReader] smoke=%@", smoke);
        }
      }
    }
    resolve(@(code));
#else
    reject(@"E_SDK", @"docsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(writeStatus:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id obj = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if ([obj isKindOfClass:[NSDictionary class]]) {
    DRSWriteStatusFile((NSDictionary *)obj);
  } else {
    DRSWriteStatusFile(@{ @"step": @"writeStatus", @"raw": json ?: @"" });
  }
  resolve([NSNull null]);
}

RCT_EXPORT_METHOD(deinit:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    [DocSDK deinitSDK];
    resolve([NSNull null]);
#else
    reject(@"E_SDK", @"docsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(startNewSession:(NSString *)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    NSString *json = (optionsJson == nil || optionsJson.length == 0)
      ? [DocSDK startNewSession]
      : [DocSDK startNewSession:optionsJson];
    resolve(json ?: @"");
#else
    reject(@"E_SDK", @"docsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(locateDocument:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    UIImage *image = DRSUprightCameraImage(DRSImageFromUriOrBase64(imageUri));
    if (image == nil) {
      reject(@"E_IMAGE", @"Could not decode image", nil);
      return;
    }
    CGFloat imageW = image.size.width * image.scale;
    CGFloat imageH = image.size.height * image.scale;
    UIImage *locateBmp = DRSScaledMaxEdge(image, 480.0);
    CGFloat locateW = locateBmp.size.width * locateBmp.scale;
    CGFloat locateH = locateBmp.size.height * locateBmp.scale;
    NSString *json = [DocSDK locateDocument:locateBmp] ?: @"";
    resolve(DRSRescaleLocateJson(json, locateW, locateH, imageW, imageH));
#else
    reject(@"E_SDK", @"docsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(recognize:(NSString *)frontUri
                  backUri:(NSString *)backUri
                  authenticityMode:(NSString *)authenticityMode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
#ifdef DRS_HAS_DOCSDK
    UIImage *front = DRSImageFromUriOrBase64(frontUri);
    if (front == nil) {
      reject(@"E_IMAGE", @"Could not decode front image", nil);
      return;
    }
    UIImage *back = nil;
    if (backUri != nil && backUri.length > 0) {
      back = DRSImageFromUriOrBase64(backUri);
    }
    [DocSDK startNewSession:@"{\"scenario\":\"FullProcess\",\"series\":false}"];
    NSString *mode = authenticityMode.length ? authenticityMode : @"normal";
    NSString *json = nil;
    if ([DocSDK respondsToSelector:@selector(recognizeFront:back:authenticityMode:)]) {
      json = [DocSDK recognizeFront:front back:back authenticityMode:mode];
    } else {
      json = [DocSDK recognizeFront:front back:back authenticity:![mode.lowercaseString isEqualToString:@"none"]];
    }
    resolve(json ?: @"");
#else
    reject(@"E_SDK", @"docsdk.framework not linked", nil);
#endif
  });
}

RCT_EXPORT_METHOD(lastLicenseError:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
#ifdef DRS_HAS_DOCSDK
  resolve([DocSDK lastLicenseError] ?: @"");
#else
  resolve(@"");
#endif
}

RCT_EXPORT_METHOD(getLicenseStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
#ifdef DRS_HAS_DOCSDK
  if ([DocSDK respondsToSelector:@selector(getLicenseStatus)]) {
    resolve([DocSDK getLicenseStatus] ?: @"{}");
  } else {
    resolve(@"{}");
  }
#else
  resolve(@"{}");
#endif
}

@end
