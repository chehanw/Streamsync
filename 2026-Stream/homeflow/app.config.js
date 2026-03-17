module.exports = {
  expo: {
    name: "StreamSync",
    slug: "my-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "my-app",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.chehan.homeflow",
      deploymentTarget: "16.0",
      usesAppleSignIn: true,
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? "./GoogleService-Info.plist",
    },
    android: {
      package: "com.chehan.homeflow",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.0"
          }
        }
      ],
      "./plugins/withMinDeploymentTarget",
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "This app needs access to your health data to display your health metrics and track your progress.",
          "NSHealthUpdateUsageDescription": "This app needs permission to save health data to track your activities.",
          "background": true
        }
      ],
      [
        "./plugins/withClinicalRecords",
        {
          "usageDescription": "StreamSync would like to access your clinical health records to import medications, lab results, and conditions — reducing manual data entry."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#8C1515"
        }
      ],
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.295202330543-6rlqahqi4ncgb5i0tksk3b46omhfin9e",
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "066cdee7-0684-41e8-a579-d5505029ed50"
      }
    },
  }
};
