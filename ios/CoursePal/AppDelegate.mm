#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#if DEBUG
#import <React/RCTDevLoadingView.h>
#endif

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

#if DEBUG
  [RCTDevLoadingView setEnabled:NO];
#endif

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
  NSURL *bundledURL = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  if (bundledURL) {
    return bundledURL;
  }
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return bundledURL;
#endif
}

// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  return [super application:application openURL:url options:options] || [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
  BOOL result = [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || result;
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  return [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

@end

#import <PDFKit/PDFKit.h>
#import <React/RCTBridgeModule.h>
#include <zlib.h>

static NSString* ExtractTextFromDocxData(NSData *data) {
  if (!data || data.length < 30) return @"";
  const uint8_t *bytes = (const uint8_t *)data.bytes;
  NSUInteger len = data.length;
  NSUInteger pos = 0;

  while (pos + 30 <= len) {
    if (bytes[pos] == 0x50 && bytes[pos+1] == 0x4B && bytes[pos+2] == 0x03 && bytes[pos+3] == 0x04) {
      uint16_t compressionMethod = bytes[pos+8] | (bytes[pos+9] << 8);
      uint32_t compSize = bytes[pos+18] | (bytes[pos+19] << 8) | (bytes[pos+20] << 16) | (bytes[pos+21] << 24);
      uint32_t uncompSize = bytes[pos+22] | (bytes[pos+23] << 8) | (bytes[pos+24] << 16) | (bytes[pos+25] << 24);
      uint16_t nameLen = bytes[pos+26] | (bytes[pos+27] << 8);
      uint16_t extraLen = bytes[pos+28] | (bytes[pos+29] << 8);

      if (pos + 30 + nameLen > len) break;

      NSString *fileName = [[NSString alloc] initWithBytes:&bytes[pos+30] length:nameLen encoding:NSUTF8StringEncoding];
      NSUInteger dataOffset = pos + 30 + nameLen + extraLen;

      if ([fileName isEqualToString:@"word/document.xml"]) {
        if (dataOffset + compSize > len) break;
        NSData *xmlData = nil;
        if (compressionMethod == 0) {
          xmlData = [NSData dataWithBytes:&bytes[dataOffset] length:compSize];
        } else if (compressionMethod == 8) {
          NSMutableData *decompressed = [NSMutableData dataWithLength:(uncompSize > 0 ? uncompSize : compSize * 6)];
          z_stream strm;
          memset(&strm, 0, sizeof(strm));
          strm.next_in = (Bytef *)&bytes[dataOffset];
          strm.avail_in = (uInt)compSize;
          strm.next_out = (Bytef *)decompressed.mutableBytes;
          strm.avail_out = (uInt)decompressed.length;

          if (inflateInit2(&strm, -MAX_WBITS) == Z_OK) {
            int ret = inflate(&strm, Z_FINISH);
            if (ret == Z_STREAM_END || ret == Z_OK) {
              decompressed.length = strm.total_out;
              xmlData = decompressed;
            }
            inflateEnd(&strm);
          }
        }

        if (xmlData) {
          NSString *xmlString = [[NSString alloc] initWithData:xmlData encoding:NSUTF8StringEncoding];
          if (!xmlString) {
            xmlString = [[NSString alloc] initWithData:xmlData encoding:NSISOLatin1StringEncoding];
          }
          if (xmlString) {
            NSMutableString *clean = [NSMutableString stringWithString:xmlString];
            [clean replaceOccurrencesOfString:@"</w:p>" withString:@"\n" options:0 range:NSMakeRange(0, clean.length)];
            [clean replaceOccurrencesOfString:@"<w:br/>" withString:@"\n" options:0 range:NSMakeRange(0, clean.length)];
            [clean replaceOccurrencesOfString:@"<w:br />" withString:@"\n" options:0 range:NSMakeRange(0, clean.length)];
            [clean replaceOccurrencesOfString:@"<w:tab/>" withString:@"\t" options:0 range:NSMakeRange(0, clean.length)];
            [clean replaceOccurrencesOfString:@"<w:tab />" withString:@"\t" options:0 range:NSMakeRange(0, clean.length)];
            NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"<[^>]+>" options:0 error:nil];
            NSString *plain = [regex stringByReplacingMatchesInString:clean options:0 range:NSMakeRange(0, clean.length) withTemplate:@""];
            plain = [plain stringByReplacingOccurrencesOfString:@"&amp;" withString:@"&"];
            plain = [plain stringByReplacingOccurrencesOfString:@"&lt;" withString:@"<"];
            plain = [plain stringByReplacingOccurrencesOfString:@"&gt;" withString:@">"];
            plain = [plain stringByReplacingOccurrencesOfString:@"&quot;" withString:@"\""];
            plain = [plain stringByReplacingOccurrencesOfString:@"&apos;" withString:@"'"];
            return [plain stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
          }
        }
      }
      pos = dataOffset + compSize;
    } else {
      pos++;
    }
  }
  return @"";
}

@interface PDFTextExtractor : NSObject <RCTBridgeModule>
@end

@implementation PDFTextExtractor

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(extractText:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (!filePath || filePath.length == 0) {
      resolve(@"");
      return;
    }

    NSURL *url = nil;
    NSString *cleanPath = filePath;
    if ([cleanPath hasPrefix:@"file://"]) {
      url = [NSURL URLWithString:cleanPath];
      cleanPath = [cleanPath substringFromIndex:7];
    }
    cleanPath = [cleanPath stringByRemovingPercentEncoding];

    if (!url && cleanPath) {
      url = [NSURL fileURLWithPath:cleanPath];
    }

    BOOL isSecurityScoped = NO;
    if (url && [url respondsToSelector:@selector(startAccessingSecurityScopedResource)]) {
      isSecurityScoped = [url startAccessingSecurityScopedResource];
    }

    @try {
      NSData *fileData = nil;
      if (cleanPath) {
        fileData = [NSData dataWithContentsOfFile:cleanPath];
      }
      if ((!fileData || fileData.length == 0) && url) {
        fileData = [NSData dataWithContentsOfURL:url];
      }

      if (!fileData || fileData.length == 0) {
        resolve(@"");
        return;
      }

      // Check 1: DOCX extraction (PK header)
      if (fileData.length >= 4) {
        const uint8_t *b = (const uint8_t *)fileData.bytes;
        if (b[0] == 0x50 && b[1] == 0x4B) {
          NSString *docxText = ExtractTextFromDocxData(fileData);
          if (docxText && docxText.length > 20) {
            resolve(docxText);
            return;
          }
        }
      }

      // Check 2: PDF extraction (PDFKit)
      PDFDocument *doc = [[PDFDocument alloc] initWithData:fileData];
      if (doc && doc.pageCount > 0) {
        NSMutableString *fullText = [NSMutableString string];
        for (NSUInteger i = 0; i < doc.pageCount; i++) {
          PDFPage *page = [doc pageAtIndex:i];
          if (page && page.string && page.string.length > 0) {
            [fullText appendString:page.string];
            [fullText appendString:@"\n"];
          }
        }
        if (fullText.length > 0) {
          resolve(fullText);
          return;
        }
      }

      // Check 3: Plain text UTF-8 / ASCII
      NSString *utf8 = [[NSString alloc] initWithData:fileData encoding:NSUTF8StringEncoding];
      if (utf8 && utf8.length > 20 && ![utf8 hasPrefix:@"%PDF-"]) {
        resolve(utf8);
        return;
      }

      // Check 4: RTF / HTML via NSAttributedString
      NSError *attrErr = nil;
      NSAttributedString *attrStr = [[NSAttributedString alloc] initWithData:fileData
                                                                     options:@{NSDocumentTypeDocumentAttribute: NSPlainTextDocumentType}
                                                          documentAttributes:nil
                                                                       error:&attrErr];
      if (attrStr && attrStr.string && attrStr.string.length > 20) {
        resolve(attrStr.string);
        return;
      }

      resolve(@"");
    } @finally {
      if (isSecurityScoped) {
        [url stopAccessingSecurityScopedResource];
      }
    }
  } @catch (NSException *exception) {
    resolve(@"");
  }
}

@end

@interface BackgroundTaskManager : NSObject <RCTBridgeModule>
@end

@implementation BackgroundTaskManager {
  NSMutableDictionary<NSString *, NSNumber *> *_activeTasks;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  if (self = [super init]) {
    _activeTasks = [NSMutableDictionary dictionary];
  }
  return self;
}

RCT_EXPORT_METHOD(beginBackgroundTask:(NSString *)taskName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIBackgroundTaskIdentifier taskId = [[UIApplication sharedApplication] beginBackgroundTaskWithName:taskName expirationHandler:^{
      dispatch_async(dispatch_get_main_queue(), ^{
        NSNumber *ident = self->_activeTasks[taskName];
        if (ident) {
          UIBackgroundTaskIdentifier tid = [ident unsignedIntegerValue];
          if (tid != UIBackgroundTaskInvalid) {
            [[UIApplication sharedApplication] endBackgroundTask:tid];
          }
          [self->_activeTasks removeObjectForKey:taskName];
        }
      });
    }];
    self->_activeTasks[taskName] = @(taskId);
    resolve(@(taskId));
  });
}

RCT_EXPORT_METHOD(endBackgroundTask:(NSString *)taskName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSNumber *ident = self->_activeTasks[taskName];
    if (ident) {
      UIBackgroundTaskIdentifier taskId = [ident unsignedIntegerValue];
      if (taskId != UIBackgroundTaskInvalid) {
        [[UIApplication sharedApplication] endBackgroundTask:taskId];
      }
      [self->_activeTasks removeObjectForKey:taskName];
    }
    resolve(@(YES));
  });
}

@end
