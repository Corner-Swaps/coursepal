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
    if ([filePath hasPrefix:@"file://"]) {
      url = [NSURL URLWithString:filePath];
      if (!url || ![[NSFileManager defaultManager] fileExistsAtPath:url.path]) {
        NSString *unescaped = [filePath stringByRemovingPercentEncoding];
        if (unescaped) {
          if ([unescaped hasPrefix:@"file://"]) {
            url = [NSURL fileURLWithPath:[unescaped substringFromIndex:7]];
          } else {
            url = [NSURL fileURLWithPath:unescaped];
          }
        }
      }
    } else {
      url = [NSURL fileURLWithPath:filePath];
    }

    if (!url) {
      resolve(@"");
      return;
    }

    PDFDocument *doc = [[PDFDocument alloc] initWithURL:url];
    if (!doc || doc.pageCount == 0) {
      NSData *data = [NSData dataWithContentsOfURL:url];
      if (data && data.length > 0) {
        doc = [[PDFDocument alloc] initWithData:data];
      }
    }

    if (!doc || doc.pageCount == 0) {
      resolve(@"");
      return;
    }

    NSMutableString *fullText = [NSMutableString string];
    for (NSUInteger i = 0; i < doc.pageCount; i++) {
      PDFPage *page = [doc pageAtIndex:i];
      if (page && page.string) {
        [fullText appendString:page.string];
        [fullText appendString:@"\n"];
      }
    }
    resolve(fullText);
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
