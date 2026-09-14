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

@interface CoursePalDocumentPrintRenderer : UIPrintPageRenderer
@property (nonatomic, assign) CGRect customPaperRect;
@property (nonatomic, assign) CGRect customPrintableRect;
@end

@implementation CoursePalDocumentPrintRenderer
- (CGRect)paperRect {
  return self.customPaperRect;
}
- (CGRect)printableRect {
  return self.customPrintableRect;
}
@end

static void ExtractTextAndHtmlFromDocxData(NSData *data, NSString **outPlainText, NSString **outHtml) {
  if (!data || data.length < 30) {
    if (outPlainText) *outPlainText = @"";
    if (outHtml) *outHtml = @"";
    return;
  }
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
          NSString *xml = [[NSString alloc] initWithData:xmlData encoding:NSUTF8StringEncoding];
          if (!xml) {
            xml = [[NSString alloc] initWithData:xmlData encoding:NSISOLatin1StringEncoding];
          }
          if (xml) {
            // Strip out <w:instrText>...</w:instrText> field instructions
            NSRegularExpression *instrRegex = [NSRegularExpression regularExpressionWithPattern:@"<w:instrText(?:\\s+[^>]*)?>[\\s\\S]*?</w:instrText>"
                                                                                        options:0
                                                                                          error:nil];
            xml = [instrRegex stringByReplacingMatchesInString:xml options:0 range:NSMakeRange(0, xml.length) withTemplate:@""];

            // Helper block to decode XML entities
            NSString* (^decodeXml)(NSString*) = ^NSString* (NSString* input) {
              if (!input) return @"";
              NSString *res = [input stringByReplacingOccurrencesOfString:@"&amp;" withString:@"&"];
              res = [res stringByReplacingOccurrencesOfString:@"&lt;" withString:@"<"];
              res = [res stringByReplacingOccurrencesOfString:@"&gt;" withString:@">"];
              res = [res stringByReplacingOccurrencesOfString:@"&quot;" withString:@"\""];
              res = [res stringByReplacingOccurrencesOfString:@"&apos;" withString:@"'"];
              return res;
            };

            // Helper block to extract text inside <w:t> elements within a snippet
            NSRegularExpression *textRegex = [NSRegularExpression regularExpressionWithPattern:@"<w:t(?:\\s+[^>]*)?>([\\s\\S]*?)</w:t>"
                                                                                       options:0
                                                                                         error:nil];
            NSString* (^extractTextFromSnippet)(NSString*) = ^NSString* (NSString* snippet) {
              if (!snippet) return @"";
              NSMutableString *buf = [NSMutableString string];
              NSArray<NSTextCheckingResult *> *matches = [textRegex matchesInString:snippet options:0 range:NSMakeRange(0, snippet.length)];
              for (NSTextCheckingResult *m in matches) {
                if (m.numberOfRanges > 1) {
                  NSRange r = [m rangeAtIndex:1];
                  if (r.location != NSNotFound) {
                    [buf appendString:[snippet substringWithRange:r]];
                  }
                }
              }
              return decodeXml(buf);
            };

            NSMutableString *plainTextBuf = [NSMutableString string];
            NSMutableString *htmlBuf = [NSMutableString string];

            // Parse document body child elements: tables (<w:tbl>) and paragraphs (<w:p>)
            NSRegularExpression *blockRegex = [NSRegularExpression regularExpressionWithPattern:@"<(w:tbl|w:p)(?:\\s+[^>]*)?>([\\s\\S]*?)</\\1>"
                                                                                        options:0
                                                                                          error:nil];
            NSArray<NSTextCheckingResult *> *blocks = [blockRegex matchesInString:xml options:0 range:NSMakeRange(0, xml.length)];

            for (NSTextCheckingResult *b in blocks) {
              NSString *tag = [xml substringWithRange:[b rangeAtIndex:1]];
              NSString *blockContent = [xml substringWithRange:[b rangeAtIndex:2]];

              if ([tag isEqualToString:@"w:tbl"]) {
                // Parse table rows <w:tr>
                NSRegularExpression *rowRegex = [NSRegularExpression regularExpressionWithPattern:@"<w:tr(?:\\s+[^>]*)?>([\\s\\S]*?)</w:tr>"
                                                                                          options:0
                                                                                            error:nil];
                NSArray<NSTextCheckingResult *> *rows = [rowRegex matchesInString:blockContent options:0 range:NSMakeRange(0, blockContent.length)];

                [htmlBuf appendString:@"<table border=\"1\" cellspacing=\"0\" cellpadding=\"8\" style=\"border-collapse:collapse;width:100%;margin:16px 0;font-size:11pt;\">\n"];

                BOOL isFirstRow = YES;
                for (NSTextCheckingResult *rowResult in rows) {
                  NSString *rowContent = [blockContent substringWithRange:[rowResult rangeAtIndex:1]];
                  NSRegularExpression *cellRegex = [NSRegularExpression regularExpressionWithPattern:@"<w:tc(?:\\s+[^>]*)?>([\\s\\S]*?)</w:tc>"
                                                                                             options:0
                                                                                               error:nil];
                  NSArray<NSTextCheckingResult *> *cells = [cellRegex matchesInString:rowContent options:0 range:NSMakeRange(0, rowContent.length)];

                  NSMutableArray<NSString *> *cellTexts = [NSMutableArray array];
                  [htmlBuf appendString:@"<tr>\n"];

                  for (NSTextCheckingResult *cellResult in cells) {
                    NSString *cellContent = [rowContent substringWithRange:[cellResult rangeAtIndex:1]];
                    NSString *cellText = [[extractTextFromSnippet(cellContent) stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]] stringByReplacingOccurrencesOfString:@"\n" withString:@" "];
                    [cellTexts addObject:cellText];

                    NSString *cellTag = isFirstRow ? @"th" : @"td";
                    NSString *cellStyle = isFirstRow ? @"background-color:#F1F5F9;font-weight:bold;text-align:left;border:1px solid #CBD5E1;padding:8px;" : @"border:1px solid #E2E8F0;padding:8px;vertical-align:top;";
                    [htmlBuf appendFormat:@"  <%@ style=\"%@\">%@</%@>\n", cellTag, cellStyle, cellText, cellTag];
                  }

                  [htmlBuf appendString:@"</tr>\n"];

                  if (cellTexts.count > 0) {
                    [plainTextBuf appendFormat:@"| %@ |\n", [cellTexts componentsJoinedByString:@" | "]];
                  }
                  isFirstRow = NO;
                }

                [htmlBuf appendString:@"</table>\n\n"];
                [plainTextBuf appendString:@"\n"];
              } else if ([tag isEqualToString:@"w:p"]) {
                NSString *pText = [extractTextFromSnippet(blockContent) stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                if (pText.length > 0) {
                  [plainTextBuf appendString:pText];
                  [plainTextBuf appendString:@"\n\n"];

                  if (pText.length < 70 && ([pText hasPrefix:@"CPC"] || [pText hasPrefix:@"School"] || [pText hasPrefix:@"Course"] || [pText hasPrefix:@"Syllabus"])) {
                    [htmlBuf appendFormat:@"<h3 style=\"color:#0F172A;margin:12px 0 4px;\">%@</h3>\n", pText];
                  } else {
                    [htmlBuf appendFormat:@"<p style=\"margin:4px 0;line-height:1.5;\">%@</p>\n", pText];
                  }
                }
              }
            }

            if (outPlainText) {
              *outPlainText = [plainTextBuf stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
            }
            if (outHtml) {
              *outHtml = [NSString stringWithFormat:
                @"<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
                @"<style>"
                @"body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #1E293B; margin: 36px; }"
                @"h1, h2, h3, h4 { color: #0F172A; font-weight: 700; }"
                @"table { width: 100%%; border-collapse: collapse; margin: 16px 0; page-break-inside: auto; }"
                @"tr { page-break-inside: avoid; page-break-after: auto; }"
                @"th, td { border: 1px solid #CBD5E1; padding: 8px 10px; font-size: 10.5pt; }"
                @"th { background-color: #F1F5F9; font-weight: 700; text-align: left; }"
                @"p { margin: 6px 0; }"
                @"</style></head><body>%@</body></html>", htmlBuf];
            }
            return;
          }
        }
      }
      pos = dataOffset + compSize;
    } else {
      pos++;
    }
  }
  if (outPlainText) *outPlainText = @"";
  if (outHtml) *outHtml = @"";
}

static NSData* RenderHtmlToPdfData(NSString *html) {
  if (!html || html.length == 0) return nil;

  __block NSData *pdfResult = nil;
  void (^generatePdf)(void) = ^{
    @try {
      CoursePalDocumentPrintRenderer *renderer = [[CoursePalDocumentPrintRenderer alloc] init];
      UIMarkupTextPrintFormatter *formatter = [[UIMarkupTextPrintFormatter alloc] initWithMarkupText:html];
      [renderer addPrintFormatter:formatter startingAtPageAtIndex:0];

      // Standard US Letter: 612 x 792 pt
      CGRect paper = CGRectMake(0, 0, 612, 792);
      CGRect printable = CGRectMake(36, 36, 612 - 72, 792 - 72);
      renderer.customPaperRect = paper;
      renderer.customPrintableRect = printable;

      NSMutableData *pdfData = [NSMutableData data];
      UIGraphicsBeginPDFContextToData(pdfData, paper, nil);
      for (NSInteger i = 0; i < renderer.numberOfPages; i++) {
        UIGraphicsBeginPDFPage();
        [renderer drawPageAtIndex:i inRect:printable];
      }
      UIGraphicsEndPDFContext();

      if (pdfData.length > 100) {
        pdfResult = pdfData;
      }
    } @catch (NSException *e) {
      NSLog(@"RenderHtmlToPdfData exception: %@", e);
    }
  };

  if ([NSThread isMainThread]) {
    generatePdf();
  } else {
    dispatch_sync(dispatch_get_main_queue(), generatePdf);
  }

  return pdfResult;
}

static NSString* ResolveLocalFilePath(NSString *rawPath) {
  if (!rawPath || rawPath.length == 0) return nil;
  NSString *clean = rawPath;
  if ([clean hasPrefix:@"file://"]) {
    clean = [clean substringFromIndex:7];
  }
  clean = [clean stringByRemovingPercentEncoding];

  if ([[NSFileManager defaultManager] fileExistsAtPath:clean]) {
    return clean;
  }

  // Auto-resolve outdated container UUIDs across app re-installs and launches
  NSArray<NSString *> *markers = @[@"/Documents/", @"/Library/Caches/", @"/Library/", @"/tmp/"];
  NSString *homeDir = NSHomeDirectory();
  for (NSString *marker in markers) {
    NSRange r = [clean rangeOfString:marker];
    if (r.location != NSNotFound) {
      NSString *relativeSubpath = [clean substringFromIndex:r.location + 1];
      NSString *remapped = [homeDir stringByAppendingPathComponent:relativeSubpath];
      if ([[NSFileManager defaultManager] fileExistsAtPath:remapped]) {
        return remapped;
      }
    }
  }
  return clean;
}

@interface QuickLookPresenter : NSObject <UIDocumentInteractionControllerDelegate>
@property (nonatomic, strong) UIDocumentInteractionController *docController;
+ (instancetype)shared;
- (void)presentDocumentAtURL:(NSURL *)url;
@end

@implementation QuickLookPresenter
+ (instancetype)shared {
  static QuickLookPresenter *inst = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    inst = [[QuickLookPresenter alloc] init];
  });
  return inst;
}

- (void)presentDocumentAtURL:(NSURL *)url {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *keyWindow = nil;
    for (UIWindowScene *scene in [UIApplication sharedApplication].connectedScenes) {
      if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
        for (UIWindow *w in ((UIWindowScene *)scene).windows) {
          if (w.isKeyWindow) {
            keyWindow = w;
            break;
          }
        }
      }
    }
    if (!keyWindow) {
      keyWindow = [UIApplication sharedApplication].delegate.window;
    }
    UIViewController *rootVC = keyWindow.rootViewController;
    while (rootVC.presentedViewController) {
      rootVC = rootVC.presentedViewController;
    }
    self.docController = [UIDocumentInteractionController interactionControllerWithURL:url];
    self.docController.delegate = self;
    [self.docController presentPreviewAnimated:YES];
  });
}

- (UIViewController *)documentInteractionControllerViewControllerForPreview:(UIDocumentInteractionController *)controller {
  UIWindow *keyWindow = nil;
  for (UIWindowScene *scene in [UIApplication sharedApplication].connectedScenes) {
    if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
      for (UIWindow *w in ((UIWindowScene *)scene).windows) {
        if (w.isKeyWindow) {
          keyWindow = w;
          break;
        }
      }
    }
  }
  if (!keyWindow) {
    keyWindow = [UIApplication sharedApplication].delegate.window;
  }
  UIViewController *rootVC = keyWindow.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  return rootVC;
}
@end

static NSDictionary* RenderPdfDocumentPages(PDFDocument *doc, NSInteger maxPages, NSString *docId, NSString *targetDir) {
  if (!doc || doc.pageCount == 0) {
    return @{@"pageCount": @0, @"imageUris": @[], @"base64Pages": @[]};
  }

  NSUInteger limit = maxPages > 0 ? MIN((NSUInteger)maxPages, doc.pageCount) : MIN((NSUInteger)12, doc.pageCount);
  NSMutableArray<NSString *> *imageUris = [NSMutableArray array];
  NSMutableArray<NSString *> *base64Pages = [NSMutableArray array];

  // Ensure target directory exists
  [[NSFileManager defaultManager] createDirectoryAtPath:targetDir withIntermediateDirectories:YES attributes:nil error:nil];

  for (NSUInteger i = 0; i < limit; i++) {
    @autoreleasepool {
      PDFPage *page = [doc pageAtIndex:i];
      if (!page) continue;

      CGRect pageBounds = [page boundsForBox:kPDFDisplayBoxCropBox];
      if (pageBounds.size.width <= 0 || pageBounds.size.height <= 0) {
        pageBounds = [page boundsForBox:kPDFDisplayBoxMediaBox];
      }
      if (pageBounds.size.width <= 0 || pageBounds.size.height <= 0) {
        pageBounds = CGRectMake(0, 0, 612, 792);
      }

      CGFloat targetWidth = 1200.0;
      CGFloat scale = targetWidth / MAX(pageBounds.size.width, 1.0);
      CGSize targetSize = CGSizeMake(targetWidth, ceil(pageBounds.size.height * scale));

      // Method 1: Official Apple PDFPage thumbnail API (handles orientation, rotation, transforms, font rendering)
      UIImage *img = [page thumbnailOfSize:targetSize forBox:kPDFDisplayBoxCropBox];
      if (!img || img.size.width <= 0) {
        img = [page thumbnailOfSize:targetSize forBox:kPDFDisplayBoxMediaBox];
      }

      // Fallback Method 2: UIGraphicsImageRenderer if thumbnail is nil
      if (!img || img.size.width <= 0) {
        UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
        format.scale = 1.0;
        format.opaque = YES;
        UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:targetSize format:format];

        img = [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull context) {
          CGContextRef cg = context.CGContext;
          [[UIColor whiteColor] setFill];
          CGContextFillRect(cg, CGRectMake(0, 0, targetSize.width, targetSize.height));

          CGContextSetInterpolationQuality(cg, kCGInterpolationHigh);
          CGContextSetRenderingIntent(cg, kCGRenderingIntentDefault);

          CGContextSaveGState(cg);
          CGContextTranslateCTM(cg, 0.0, targetSize.height);
          CGContextScaleCTM(cg, scale, -scale);
          CGContextTranslateCTM(cg, -pageBounds.origin.x, -pageBounds.origin.y);

          [page drawWithBox:kPDFDisplayBoxCropBox toContext:cg];
          CGContextRestoreGState(cg);
        }];
      }

      if (!img) continue;

      NSData *jpgData = UIImageJPEGRepresentation(img, 0.88);
      if (!jpgData || jpgData.length == 0) continue;

      NSString *pageFileName = [NSString stringWithFormat:@"doc_page_%@_%lu.jpg", docId, (unsigned long)i];
      NSString *fullPath = [targetDir stringByAppendingPathComponent:pageFileName];
      [jpgData writeToFile:fullPath atomically:YES];

      NSString *fileUri = [NSString stringWithFormat:@"file://%@", fullPath];
      [imageUris addObject:fileUri];

      NSString *b64 = [jpgData base64EncodedStringWithOptions:0];
      if (b64) {
        [base64Pages addObject:b64];
      }
    }
  }

  return @{
    @"pageCount": @(doc.pageCount),
    @"imageUris": imageUris,
    @"base64Pages": base64Pages
  };
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

    NSString *cleanPath = ResolveLocalFilePath(filePath);
    NSURL *url = cleanPath ? [NSURL fileURLWithPath:cleanPath] : nil;

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
          NSString *docxText = nil;
          NSString *docxHtml = nil;
          ExtractTextAndHtmlFromDocxData(fileData, &docxText, &docxHtml);
          if (docxText && docxText.length > 20) {
            resolve(docxText);
            return;
          }
        }
      }

      // Check 2: PDF extraction (PDFKit with layout-aware line sorting)
      PDFDocument *doc = [[PDFDocument alloc] initWithData:fileData];
      if (doc && doc.pageCount > 0) {
        NSMutableString *fullText = [NSMutableString string];
        for (NSUInteger i = 0; i < doc.pageCount; i++) {
          PDFPage *page = [doc pageAtIndex:i];
          if (!page) continue;
          NSString *rawStr = page.string;
          if (!rawStr || rawStr.length == 0) continue;

          PDFSelection *pageSel = [page selectionForRange:NSMakeRange(0, rawStr.length)];
          NSArray<PDFSelection *> *lines = [pageSel selectionsByLine];
          if (lines && lines.count > 0) {
            NSMutableArray<PDFSelection *> *sortedLines = [lines mutableCopy];
            [sortedLines sortUsingComparator:^NSComparisonResult(PDFSelection *l1, PDFSelection *l2) {
              CGRect b1 = [l1 boundsForPage:page];
              CGRect b2 = [l2 boundsForPage:page];
              CGFloat midY1 = CGRectGetMidY(b1);
              CGFloat midY2 = CGRectGetMidY(b2);
              if (fabs(midY1 - midY2) > 8.0) {
                return midY1 > midY2 ? NSOrderedAscending : NSOrderedDescending;
              }
              CGFloat minX1 = CGRectGetMinX(b1);
              CGFloat minX2 = CGRectGetMinX(b2);
              if (minX1 < minX2) return NSOrderedAscending;
              if (minX1 > minX2) return NSOrderedDescending;
              return NSOrderedSame;
            }];

            for (PDFSelection *line in sortedLines) {
              NSString *s = line.string;
              if (s && s.length > 0) {
                NSString *trimmed = [s stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                if (trimmed.length > 0) {
                  [fullText appendString:trimmed];
                  [fullText appendString:@"\n"];
                }
              }
            }
            [fullText appendString:@"\n"];
          } else {
            [fullText appendString:rawStr];
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

RCT_EXPORT_METHOD(renderPDFPages:(NSString *)filePath
                  maxPages:(NSInteger)maxPages
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (!filePath || filePath.length == 0) {
      resolve(@{@"pageCount": @0, @"imageUris": @[], @"base64Pages": @[]});
      return;
    }

    NSString *cleanPath = ResolveLocalFilePath(filePath);
    NSURL *url = cleanPath ? [NSURL fileURLWithPath:cleanPath] : nil;

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
        resolve(@{@"pageCount": @0, @"imageUris": @[], @"base64Pages": @[]});
        return;
      }

      NSString *docDir = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
      NSString *targetDir = [docDir stringByAppendingPathComponent:@"CoursePal_Rendered_Pages"];
      NSString *docId = [[NSUUID UUID] UUIDString];

      // Check 1: Real PDF Document
      PDFDocument *doc = [[PDFDocument alloc] initWithData:fileData];
      if (doc && doc.pageCount > 0) {
        NSDictionary *res = RenderPdfDocumentPages(doc, maxPages, docId, targetDir);
        resolve(res);
        return;
      }

      // Check 2: DOCX Document (PK zip header)
      if (fileData.length >= 4) {
        const uint8_t *b = (const uint8_t *)fileData.bytes;
        if (b[0] == 0x50 && b[1] == 0x4B) {
          NSString *plain = nil;
          NSString *html = nil;
          ExtractTextAndHtmlFromDocxData(fileData, &plain, &html);
          if (html && html.length > 50) {
            NSData *pdfData = RenderHtmlToPdfData(html);
            if (pdfData && pdfData.length > 100) {
              PDFDocument *docxDoc = [[PDFDocument alloc] initWithData:pdfData];
              if (docxDoc && docxDoc.pageCount > 0) {
                NSDictionary *res = RenderPdfDocumentPages(docxDoc, maxPages, docId, targetDir);
                resolve(res);
                return;
              }
            }
          }
        }
      }

      // Check 3: Direct Image file (PNG, JPEG, HEIC)
      UIImage *directImg = [UIImage imageWithData:fileData];
      if (directImg) {
        CGFloat targetWidth = 1200.0;
        CGFloat scale = targetWidth / MAX(directImg.size.width, 1.0);
        CGSize targetSize = CGSizeMake(targetWidth, ceil(directImg.size.height * scale));

        UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
        format.scale = 1.0;
        format.opaque = YES;
        UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:targetSize format:format];

        UIImage *scaled = [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull context) {
          [[UIColor whiteColor] setFill];
          CGContextFillRect(context.CGContext, CGRectMake(0, 0, targetSize.width, targetSize.height));
          [directImg drawInRect:CGRectMake(0, 0, targetSize.width, targetSize.height)];
        }];

        NSData *jpgData = UIImageJPEGRepresentation(scaled ?: directImg, 0.88);
        if (jpgData) {
          [[NSFileManager defaultManager] createDirectoryAtPath:targetDir withIntermediateDirectories:YES attributes:nil error:nil];
          NSString *pageFileName = [NSString stringWithFormat:@"doc_page_%@_0.jpg", docId];
          NSString *fullPath = [targetDir stringByAppendingPathComponent:pageFileName];
          [jpgData writeToFile:fullPath atomically:YES];

          NSString *fileUri = [NSString stringWithFormat:@"file://%@", fullPath];
          NSString *b64 = [jpgData base64EncodedStringWithOptions:0];
          resolve(@{
            @"pageCount": @1,
            @"imageUris": @[fileUri],
            @"base64Pages": b64 ? @[b64] : @[]
          });
          return;
        }
      }

      // Check 4: Plain text / RTF / HTML -> render as styled PDF
      NSString *textStr = [[NSString alloc] initWithData:fileData encoding:NSUTF8StringEncoding];
      if (!textStr) {
        textStr = [[NSString alloc] initWithData:fileData encoding:NSISOLatin1StringEncoding];
      }
      if (textStr && textStr.length > 20) {
        NSString *escaped = [textStr stringByReplacingOccurrencesOfString:@"&" withString:@"&amp;"];
        escaped = [escaped stringByReplacingOccurrencesOfString:@"<" withString:@"&lt;"];
        escaped = [escaped stringByReplacingOccurrencesOfString:@">" withString:@"&gt;"];
        escaped = [escaped stringByReplacingOccurrencesOfString:@"\n" withString:@"<br>"];
        NSString *html = [NSString stringWithFormat:@"<!DOCTYPE html><html><body style=\"font-family:-apple-system;font-size:12pt;line-height:1.5;margin:36px;color:#1E293B;\"><p>%@</p></body></html>", escaped];
        NSData *pdfData = RenderHtmlToPdfData(html);
        if (pdfData && pdfData.length > 100) {
          PDFDocument *txtDoc = [[PDFDocument alloc] initWithData:pdfData];
          if (txtDoc && txtDoc.pageCount > 0) {
            NSDictionary *res = RenderPdfDocumentPages(txtDoc, maxPages, docId, targetDir);
            resolve(res);
            return;
          }
        }
      }

      resolve(@{@"pageCount": @0, @"imageUris": @[], @"base64Pages": @[]});
    } @finally {
      if (isSecurityScoped) {
        [url stopAccessingSecurityScopedResource];
      }
    }
  } @catch (NSException *exception) {
    resolve(@{@"pageCount": @0, @"imageUris": @[], @"base64Pages": @[]});
  }
}

RCT_EXPORT_METHOD(openQuickLook:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (!filePath || filePath.length == 0) {
      resolve(@(NO));
      return;
    }
    NSString *resolved = ResolveLocalFilePath(filePath);
    if (resolved && [[NSFileManager defaultManager] fileExistsAtPath:resolved]) {
      [[QuickLookPresenter shared] presentDocumentAtURL:[NSURL fileURLWithPath:resolved]];
      resolve(@(YES));
      return;
    }
    resolve(@(NO));
  } @catch (NSException *e) {
    resolve(@(NO));
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

#import <StoreKit/StoreKit.h>

@interface AppleStoreReviewManager : NSObject <RCTBridgeModule>
@end

@implementation AppleStoreReviewManager

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

RCT_EXPORT_METHOD(requestReview:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (@available(iOS 14.0, *)) {
      UIWindowScene *activeScene = nil;
      for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
          activeScene = (UIWindowScene *)scene;
          break;
        }
      }
      if (!activeScene) {
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
          if ([scene isKindOfClass:[UIWindowScene class]]) {
            activeScene = (UIWindowScene *)scene;
            break;
          }
        }
      }
      if (activeScene) {
        [SKStoreReviewController requestReviewInScene:activeScene];
        resolve(@(YES));
        return;
      }
    }

    #pragma clang diagnostic push
    #pragma clang diagnostic ignored "-Wdeprecated-declarations"
    [SKStoreReviewController requestReview];
    #pragma clang diagnostic pop
    resolve(@(YES));
  });
}

RCT_EXPORT_METHOD(openStoreReviewPage:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSURL *url = [NSURL URLWithString:@"itms-apps://itunes.apple.com/app/coursepal?action=write-review"];
    if (![[UIApplication sharedApplication] canOpenURL:url]) {
      url = [NSURL URLWithString:@"https://apps.apple.com/app/coursepal?action=write-review"];
    }
    [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:^(BOOL success) {
      resolve(@(success));
    }];
  });
}

@end

@interface CoursePalWidgetManager : NSObject <RCTBridgeModule>
@end

@implementation CoursePalWidgetManager

RCT_EXPORT_MODULE(CoursePalWidgetManager);

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(reloadTimelines:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  Class widgetCenterClass = NSClassFromString(@"WidgetCenter");
  if (widgetCenterClass) {
    SEL sharedCenterSel = NSSelectorFromString(@"sharedCenter");
    if ([widgetCenterClass respondsToSelector:sharedCenterSel]) {
      #pragma clang diagnostic push
      #pragma clang diagnostic ignored "-Warc-performSelector-leaks"
      id center = [widgetCenterClass performSelector:sharedCenterSel];
      SEL reloadSel = NSSelectorFromString(@"reloadAllTimelines");
      if ([center respondsToSelector:reloadSel]) {
        [center performSelector:reloadSel];
      }
      #pragma clang diagnostic pop
    }
  }
  resolve(@(YES));
}

@end

