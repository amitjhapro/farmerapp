# Agriapp - Low-Level Design (LLD)
## Module: Farmer Onboarding

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Draft

---

## 1. Overview

The Farmer Onboarding module handles the complete registration flow for new farmers, including profile creation, phone/email verification, and KYC documentation. This document details the REST API endpoints and React Native mobile implementation.

---

## 2. System Architecture

### 2.1 Component Diagram
```
┌─────────────────────────────────────────────────────────┐
│         React Native Mobile Application                 │
├─────────────────────────────────────────────────────────┤
│  UI Layer                                               │
│  ├── WelcomeScreen                                      │
│  ├── PhoneVerificationScreen                            │
│  ├── OTPVerificationScreen                              │
│  ├── ProfileSetupScreen                                 │
│  ├── KYCDocumentUploadScreen                            │
│  └── SuccessScreen                                      │
├─────────────────────────────────────────────────────────┤
│  Container/Smart Components                             │
│  ├── OnboardingContainer                                │
│  └── FormValidationManager                              │
├─────────────────────────────────────────────────────────┤
│  State Management (Redux/Context)                       │
│  ├── onboarding.slice                                   │
│  ├── auth.slice                                         │
│  └── user.slice                                         │
├─────────────────────────────────────────────────────────┤
│  Services Layer                                         │
│  ├── AuthService                                        │
│  ├── OnboardingService                                  │
│  ├── DocumentUploadService                              │
│  └── ValidationService                                  │
├─────────────────────────────────────────────────────────┤
│  API Client Layer (Axios/Fetch)                         │
│  └── APIClient (Interceptors, Error Handling)           │
└─────────────────────────────────────────────────────────┘
            ↓ HTTP REST Calls ↓
┌─────────────────────────────────────────────────────────┐
│              Backend REST API Server                    │
├─────────────────────────────────────────────────────────┤
│  API Endpoints (Express/FastAPI/Spring Boot)            │
│  ├── POST /api/v1/auth/register/initiate                │
│  ├── POST /api/v1/auth/verify-otp                       │
│  ├── POST /api/v1/farmers/profile                       │
│  ├── POST /api/v1/farmers/kyc/upload                    │
│  ├── GET  /api/v1/farmers/kyc/status                    │
│  └── POST /api/v1/farmers/complete-onboarding           │
├─────────────────────────────────────────────────────────┤
│  Business Logic Layer                                   │
│  ├── AuthManager                                        │
│  ├── OTPManager                                         │
│  ├── FarmerManager                                      │
│  └── KYCManager                                         │
├─────────────────────────────────────────────────────────┤
│  Data Access Layer                                      │
│  ├── FarmerRepository                                   │
│  ├── OTPRepository                                      │
│  └── DocumentRepository                                 │
├─────────────────────────────────────────────────────────┤
│  External Services                                      │
│  ├── SMS Gateway (Twilio/AWS SNS)                       │
│  ├── File Storage (AWS S3/Cloud Storage)                │
│  └── Email Service                                      │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│         Database (PostgreSQL/MySQL)                     │
├─────────────────────────────────────────────────────────┤
│  Tables                                                 │
│  ├── farmers                                            │
│  ├── otp_records                                        │
│  ├── kyc_documents                                      │
│  └── onboarding_sessions                                │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Farmers Table
```sql
CREATE TABLE farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(10), -- MALE, FEMALE, OTHER
  address_line_1 TEXT,
  address_line_2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  profile_image_url VARCHAR(500),
  kyc_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SUBMITTED, VERIFIED, REJECTED
  kyc_document_id UUID REFERENCES kyc_documents(id),
  account_status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verification_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_phone_number ON farmers(phone_number);
CREATE INDEX idx_email ON farmers(email);
CREATE INDEX idx_kyc_status ON farmers(kyc_status);
```

### 3.2 OTP Records Table
```sql
CREATE TABLE otp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) NOT NULL, -- REGISTRATION, PASSWORD_RESET, VERIFICATION
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP
);

CREATE INDEX idx_phone_otp ON otp_records(phone_number, is_verified);
CREATE INDEX idx_otp_expiry ON otp_records(expires_at);
```

### 3.3 KYC Documents Table
```sql
CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- AADHAR, PASSPORT, DRIVING_LICENSE, VOTER_ID
  document_number VARCHAR(100),
  document_image_url VARCHAR(500),
  document_back_image_url VARCHAR(500),
  verification_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
  rejection_reason TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_farmer_kyc ON kyc_documents(farmer_id);
CREATE INDEX idx_kyc_status ON kyc_documents(verification_status);
```

### 3.4 Onboarding Sessions Table
```sql
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  session_token VARCHAR(500),
  current_step VARCHAR(50), -- PHONE_ENTRY, OTP_VERIFY, PROFILE, KYC_UPLOAD, COMPLETE
  step_status JSON, -- Tracks completion of each step
  session_data JSON, -- Temporary data during onboarding
  device_info JSON, -- Device details
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_session_token ON onboarding_sessions(session_token);
CREATE INDEX idx_session_expiry ON onboarding_sessions(expires_at);
```

---

## 4. REST API Endpoints

### 4.1 Authentication & OTP Management

#### 4.1.1 Initiate Registration (Send OTP)
```
POST /api/v1/auth/register/initiate
Content-Type: application/json

Request Body:
{
  "phone_number": "+919876543210",
  "country_code": "+91",
  "device_id": "unique_device_identifier",
  "device_info": {
    "os": "iOS",
    "os_version": "16.0",
    "app_version": "1.0.0",
    "device_name": "iPhone 12"
  }
}

Response (200 OK):
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "phone_number": "+919876543210",
    "otp_expiry_seconds": 300,
    "attempt_count": 1,
    "max_attempts": 3,
    "next_retry_after_seconds": 0
  }
}

Response (400 Bad Request):
{
  "success": false,
  "error": "INVALID_PHONE_NUMBER",
  "message": "Phone number format is invalid"
}

Response (429 Too Many Requests):
{
  "success": false,
  "error": "TOO_MANY_REQUESTS",
  "message": "Too many OTP requests. Please try again after 300 seconds",
  "retry_after_seconds": 300
}
```

#### 4.1.2 Verify OTP
```
POST /api/v1/auth/verify-otp
Content-Type: application/json

Request Body:
{
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otp_code": "123456"
}

Response (200 OK):
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "farmer_exists": false,
    "next_step": "PROFILE_SETUP"
  }
}

Response (400 Bad Request):
{
  "success": false,
  "error": "INVALID_OTP",
  "message": "OTP is incorrect",
  "attempts_remaining": 2
}

Response (410 Gone):
{
  "success": false,
  "error": "OTP_EXPIRED",
  "message": "OTP has expired. Please request a new one"
}
```

---

### 4.2 Farmer Profile Management

#### 4.2.1 Create/Update Profile
```
POST /api/v1/farmers/profile
Content-Type: application/json
Authorization: Bearer <auth_token>

Request Body:
{
  "first_name": "Rajesh",
  "last_name": "Kumar",
  "email": "rajesh@example.com",
  "date_of_birth": "1980-05-15",
  "gender": "MALE",
  "phone_number": "+919876543210",
  "address_line_1": "123, Farm Lane",
  "address_line_2": "Opposite School",
  "city": "Indore",
  "state": "Madhya Pradesh",
  "postal_code": "452001",
  "country": "India"
}

Response (201 Created):
{
  "success": true,
  "message": "Profile created successfully",
  "data": {
    "farmer_id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Rajesh",
    "last_name": "Kumar",
    "email": "rajesh@example.com",
    "phone_number": "+919876543210",
    "profile_complete": 60,
    "kyc_status": "PENDING",
    "next_step": "KYC_UPLOAD"
  }
}

Response (400 Bad Request):
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "phone_number",
      "message": "Phone number already registered"
    }
  ]
}
```

#### 4.2.2 Upload Profile Image
```
POST /api/v1/farmers/profile/image
Content-Type: multipart/form-data
Authorization: Bearer <auth_token>

Request Body:
{
  "image": <binary_image_data>,
  "image_type": "PROFILE_PICTURE" -- PROFILE_PICTURE, SIGNATURE
}

Response (200 OK):
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "image_url": "https://s3.amazonaws.com/agriapp/farmers/550e8400.jpg",
    "image_type": "PROFILE_PICTURE"
  }
}

Response (413 Payload Too Large):
{
  "success": false,
  "error": "FILE_TOO_LARGE",
  "message": "Image size exceeds 5MB limit"
}
```

#### 4.2.3 Get Profile
```
GET /api/v1/farmers/profile
Authorization: Bearer <auth_token>

Response (200 OK):
{
  "success": true,
  "data": {
    "farmer_id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Rajesh",
    "last_name": "Kumar",
    "email": "rajesh@example.com",
    "phone_number": "+919876543210",
    "date_of_birth": "1980-05-15",
    "gender": "MALE",
    "address_line_1": "123, Farm Lane",
    "address_line_2": "Opposite School",
    "city": "Indore",
    "state": "Madhya Pradesh",
    "postal_code": "452001",
    "country": "India",
    "profile_image_url": "https://s3.amazonaws.com/agriapp/farmers/550e8400.jpg",
    "profile_complete_percentage": 60,
    "kyc_status": "PENDING",
    "account_status": "ACTIVE",
    "registration_date": "2026-02-28T10:30:00Z"
  }
}
```

---

### 4.3 KYC Document Management

#### 4.3.1 Upload KYC Document
```
POST /api/v1/farmers/kyc/upload
Content-Type: multipart/form-data
Authorization: Bearer <auth_token>

Request Body:
{
  "document_type": "AADHAR", -- AADHAR, PASSPORT, DRIVING_LICENSE, VOTER_ID
  "document_number": "123456789012",
  "front_image": <binary_image_data>,
  "back_image": <binary_image_data> (optional)
}

Response (201 Created):
{
  "success": true,
  "message": "KYC document uploaded successfully",
  "data": {
    "kyc_document_id": "660e8400-e29b-41d4-a716-446655440111",
    "document_type": "AADHAR",
    "document_number": "123456789012",
    "verification_status": "PENDING",
    "front_image_url": "https://s3.amazonaws.com/agriapp/kyc/660e8400-front.jpg",
    "back_image_url": "https://s3.amazonaws.com/agriapp/kyc/660e8400-back.jpg",
    "submitted_at": "2026-02-28T10:35:00Z"
  }
}

Response (400 Bad Request):
{
  "success": false,
  "error": "INVALID_DOCUMENT",
  "message": "Document images are unclear or invalid. Please retake the photos."
}
```

#### 4.3.2 Get KYC Status
```
GET /api/v1/farmers/kyc/status
Authorization: Bearer <auth_token>

Response (200 OK):
{
  "success": true,
  "data": {
    "overall_kyc_status": "PENDING",
    "documents": [
      {
        "kyc_document_id": "660e8400-e29b-41d4-a716-446655440111",
        "document_type": "AADHAR",
        "verification_status": "VERIFIED",
        "verified_at": "2026-02-28T12:00:00Z"
      }
    ],
    "next_steps": ["Complete profile information", "Verify email"],
    "onboarding_complete": false
  }
}
```

#### 4.3.3 Resend KYC Document
```
POST /api/v1/farmers/kyc/resubmit
Content-Type: multipart/form-data
Authorization: Bearer <auth_token>

Request Body:
{
  "kyc_document_id": "660e8400-e29b-41d4-a716-446655440111",
  "front_image": <binary_image_data>,
  "back_image": <binary_image_data>,
  "rejection_reason_acknowledgment": "Understood, will take clearer photos"
}

Response (200 OK):
{
  "success": true,
  "message": "Document resubmitted successfully",
  "data": {
    "verification_status": "PENDING",
    "submitted_at": "2026-02-28T14:00:00Z"
  }
}
```

---

### 4.4 Onboarding Completion

#### 4.4.1 Complete Onboarding
```
POST /api/v1/farmers/complete-onboarding
Content-Type: application/json
Authorization: Bearer <auth_token>

Request Body:
{
  "confirmation": true
}

Response (200 OK):
{
  "success": true,
  "message": "Onboarding completed successfully",
  "data": {
    "farmer_id": "550e8400-e29b-41d4-a716-446655440000",
    "onboarding_status": "COMPLETED",
    "completed_at": "2026-02-28T14:30:00Z",
    "next_screen": "DASHBOARD"
  }
}
```

#### 4.4.2 Get Onboarding Progress
```
GET /api/v1/farmers/onboarding/progress
Authorization: Bearer <auth_token>

Response (200 OK):
{
  "success": true,
  "data": {
    "overall_progress": 75,
    "steps": [
      {
        "step_name": "Phone Verification",
        "status": "COMPLETED",
        "completed_at": "2026-02-28T10:30:00Z"
      },
      {
        "step_name": "Profile Setup",
        "status": "COMPLETED",
        "completed_at": "2026-02-28T10:45:00Z"
      },
      {
        "step_name": "KYC Upload",
        "status": "IN_PROGRESS",
        "started_at": "2026-02-28T11:00:00Z"
      },
      {
        "step_name": "Email Verification",
        "status": "PENDING"
      }
    ]
  }
}
```

---

## 5. React Native Implementation

### 5.1 Project Structure
```
src/
├── screens/
│   ├── onboarding/
│   │   ├── WelcomeScreen.tsx
│   │   ├── PhoneVerificationScreen.tsx
│   │   ├── OTPVerificationScreen.tsx
│   │   ├── ProfileSetupScreen.tsx
│   │   ├── KYCDocumentUploadScreen.tsx
│   │   ├── ReviewScreen.tsx
│   │   └── SuccessScreen.tsx
│   └── ...
├── components/
│   ├── onboarding/
│   │   ├── PhoneInput.tsx
│   │   ├── OTPInput.tsx
│   │   ├── DocumentCamera.tsx
│   │   ├── DocumentPreview.tsx
│   │   ├── FormSection.tsx
│   │   └── ProgressIndicator.tsx
│   └── ...
├── navigation/
│   ├── OnboardingNavigator.tsx
│   ├── AppNavigator.tsx
│   └── RootNavigator.tsx
├── services/
│   ├── api/
│   │   ├── onboardingAPI.ts
│   │   ├── authAPI.ts
│   │   └── uploadAPI.ts
│   ├── storage/
│   │   ├── localStorage.ts
│   │   └── asyncStorage.ts
│   └── validators/
│       ├── phoneValidator.ts
│       ├── emailValidator.ts
│       └── documentValidator.ts
├── store/
│   ├── slices/
│   │   ├── onboarding.slice.ts
│   │   ├── auth.slice.ts
│   │   └── user.slice.ts
│   └── index.ts
├── hooks/
│   ├── useOnboarding.ts
│   ├── usePhoneVerification.ts
│   └── useKYCUpload.ts
├── utils/
│   ├── errorHandler.ts
│   ├── dateFormatter.ts
│   └── imageCompressor.ts
└── types/
    ├── onboarding.types.ts
    ├── auth.types.ts
    └── api.types.ts
```

### 5.2 Type Definitions

#### src/types/onboarding.types.ts
```typescript
export type OnboardingStep = 
  | 'PHONE_ENTRY'
  | 'OTP_VERIFY'
  | 'PROFILE_SETUP'
  | 'KYC_UPLOAD'
  | 'REVIEW'
  | 'COMPLETE';

export interface PhoneVerificationRequest {
  phone_number: string;
  country_code: string;
  device_id: string;
  device_info: {
    os: string;
    os_version: string;
    app_version: string;
    device_name: string;
  };
}

export interface OTPVerificationRequest {
  session_token: string;
  otp_code: string;
}

export interface FarmerProfile {
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone_number: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface KYCDocument {
  document_type: 'AADHAR' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';
  document_number: string;
  front_image: {
    uri: string;
    base64?: string;
    size: number;
    mimeType: string;
  };
  back_image?: {
    uri: string;
    base64?: string;
    size: number;
    mimeType: string;
  };
}

export interface OnboardingState {
  currentStep: OnboardingStep;
  session_token: string | null;
  auth_token: string | null;
  refresh_token: string | null;
  farmer_id: string | null;
  phone_number: string;
  profile: Partial<FarmerProfile>;
  kyc: Partial<KYCDocument>;
  progress: number;
  error: string | null;
  loading: boolean;
}
```

### 5.3 Redux Store Setup

#### src/store/slices/onboarding.slice.ts
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OnboardingState, OnboardingStep, FarmerProfile, KYCDocument } from '../../types/onboarding.types';

const initialState: OnboardingState = {
  currentStep: 'PHONE_ENTRY',
  session_token: null,
  auth_token: null,
  refresh_token: null,
  farmer_id: null,
  phone_number: '',
  profile: {},
  kyc: {},
  progress: 0,
  error: null,
  loading: false,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    setCurrentStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.currentStep = action.payload;
    },
    setSessionToken: (state, action: PayloadAction<string>) => {
      state.session_token = action.payload;
    },
    setAuthToken: (state, action: PayloadAction<{ auth_token: string; refresh_token: string }>) => {
      state.auth_token = action.payload.auth_token;
      state.refresh_token = action.payload.refresh_token;
    },
    setPhoneNumber: (state, action: PayloadAction<string>) => {
      state.phone_number = action.payload;
    },
    updateProfile: (state, action: PayloadAction<Partial<FarmerProfile>>) => {
      state.profile = { ...state.profile, ...action.payload };
    },
    updateKYC: (state, action: PayloadAction<Partial<KYCDocument>>) => {
      state.kyc = { ...state.kyc, ...action.payload };
    },
    setProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetOnboarding: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setCurrentStep,
  setSessionToken,
  setAuthToken,
  setPhoneNumber,
  updateProfile,
  updateKYC,
  setProgress,
  setLoading,
  setError,
  resetOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
```

### 5.4 API Service

#### src/services/api/onboardingAPI.ts
```typescript
import axios, { AxiosInstance } from 'axios';
import {
  PhoneVerificationRequest,
  OTPVerificationRequest,
  FarmerProfile,
  KYCDocument,
} from '../../types/onboarding.types';

class OnboardingAPI {
  private api: AxiosInstance;

  constructor(baseURL: string) {
    this.api = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add interceptor for auth tokens
    this.api.interceptors.request.use((config) => {
      const token = this.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add error handling interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  // Initiate phone verification
  async initiatePhoneVerification(
    request: PhoneVerificationRequest
  ): Promise<{
    session_token: string;
    otp_expiry_seconds: number;
  }> {
    try {
      const response = await this.api.post('/auth/register/initiate', request);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Verify OTP
  async verifyOTP(request: OTPVerificationRequest): Promise<{
    auth_token: string;
    refresh_token: string;
    farmer_exists: boolean;
  }> {
    try {
      const response = await this.api.post('/auth/verify-otp', request);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create/Update farmer profile
  async updateProfile(profile: FarmerProfile): Promise<{
    farmer_id: string;
    profile_complete: number;
  }> {
    try {
      const response = await this.api.post('/farmers/profile', profile);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Upload profile image
  async uploadProfileImage(imageUri: string, imageType: string): Promise<{
    image_url: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);
      formData.append('image_type', imageType);

      const response = await this.api.post(
        '/farmers/profile/image',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Upload KYC document
  async uploadKYCDocument(kyc: KYCDocument): Promise<{
    kyc_document_id: string;
    verification_status: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('document_type', kyc.document_type);
      formData.append('document_number', kyc.document_number);
      formData.append('front_image', {
        uri: kyc.front_image.uri,
        type: kyc.front_image.mimeType,
        name: 'front.jpg',
      } as any);

      if (kyc.back_image) {
        formData.append('back_image', {
          uri: kyc.back_image.uri,
          type: kyc.back_image.mimeType,
          name: 'back.jpg',
        } as any);
      }

      const response = await this.api.post(
        '/farmers/kyc/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get KYC status
  async getKYCStatus(): Promise<any> {
    try {
      const response = await this.api.get('/farmers/kyc/status');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Complete onboarding
  async completeOnboarding(): Promise<{ farmer_id: string }> {
    try {
      const response = await this.api.post('/farmers/complete-onboarding', {
        confirmation: true,
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get onboarding progress
  async getOnboardingProgress(): Promise<any> {
    try {
      const response = await this.api.get('/farmers/onboarding/progress');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private getAuthToken(): string | null {
    // Implementation to retrieve stored auth token
    return null;
  }

  private handleError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      throw new Error(data.message || `Error: ${status}`);
    }
    throw error;
  }
}

export default OnboardingAPI;
```

### 5.5 Custom Hooks

#### src/hooks/usePhoneVerification.ts
```typescript
import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import OnboardingAPI from '../services/api/onboardingAPI';
import {
  setPhoneNumber,
  setSessionToken,
  setLoading,
  setError,
  setCurrentStep,
} from '../store/slices/onboarding.slice';
import { RootState } from '../store';

const API_BASE_URL = 'https://api.agriapp.com/api/v1';

export const usePhoneVerification = () => {
  const dispatch = useDispatch();
  const { phone_number, session_token } = useSelector(
    (state: RootState) => state.onboarding
  );
  const [otpExpiry, setOtpExpiry] = useState<number>(0);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const api = new OnboardingAPI(API_BASE_URL);

  const sendOTP = useCallback(
    async (phoneNumber: string) => {
      try {
        dispatch(setLoading(true));
        dispatch(setError(null));

        const response = await api.initiatePhoneVerification({
          phone_number: phoneNumber,
          country_code: '+91',
          device_id: 'unique_device_id', // Get from device
          device_info: {
            os: 'iOS', // Get from device
            os_version: '16.0',
            app_version: '1.0.0',
            device_name: 'iPhone',
          },
        });

        dispatch(setPhoneNumber(phoneNumber));
        dispatch(setSessionToken(response.session_token));
        setOtpExpiry(response.otp_expiry_seconds);
        setAttemptCount(1);

        return true;
      } catch (error: any) {
        dispatch(setError(error.message));
        return false;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, api]
  );

  const resendOTP = useCallback(async () => {
    return sendOTP(phone_number);
  }, [sendOTP, phone_number]);

  return {
    sendOTP,
    resendOTP,
    otpExpiry,
    attemptCount,
    phone_number,
  };
};
```

#### src/hooks/useOTPVerification.ts
```typescript
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import OnboardingAPI from '../services/api/onboardingAPI';
import {
  setAuthToken,
  setLoading,
  setError,
  setCurrentStep,
} from '../store/slices/onboarding.slice';
import { RootState } from '../store';

const API_BASE_URL = 'https://api.agriapp.com/api/v1';

export const useOTPVerification = () => {
  const dispatch = useDispatch();
  const { session_token } = useSelector(
    (state: RootState) => state.onboarding
  );
  const api = new OnboardingAPI(API_BASE_URL);

  const verifyOTP = useCallback(
    async (otpCode: string) => {
      try {
        dispatch(setLoading(true));
        dispatch(setError(null));

        if (!session_token) {
          throw new Error('Session token not found');
        }

        const response = await api.verifyOTP({
          session_token,
          otp_code: otpCode,
        });

        dispatch(
          setAuthToken({
            auth_token: response.auth_token,
            refresh_token: response.refresh_token,
          })
        );

        const nextStep = response.farmer_exists ? 'DASHBOARD' : 'PROFILE_SETUP';
        dispatch(setCurrentStep(nextStep as any));

        return true;
      } catch (error: any) {
        dispatch(setError(error.message));
        return false;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, session_token, api]
  );

  return { verifyOTP };
};
```

### 5.6 Screen Components

#### src/screens/onboarding/PhoneVerificationScreen.tsx
```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { usePhoneVerification } from '../../hooks/usePhoneVerification';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export const PhoneVerificationScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const { sendOTP, loading } = usePhoneVerification();
  const { error } = useSelector((state: RootState) => state.onboarding);

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  const handleContinue = async () => {
    setValidationError('');

    if (!phoneInput.trim()) {
      setValidationError('Phone number is required');
      return;
    }

    if (!validatePhoneNumber(phoneInput)) {
      setValidationError('Please enter a valid 10-digit phone number');
      return;
    }

    const success = await sendOTP(`+91${phoneInput}`);
    if (success) {
      navigation.navigate('OTPVerification');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Agriapp</Text>
        <Text style={styles.subtitle}>
          Enter your phone number to get started
        </Text>

        <TextInput
          label="Phone Number"
          value={phoneInput}
          onChangeText={setPhoneInput}
          placeholder="10 digit phone number"
          keyboardType="phone-pad"
          editable={!loading}
          style={styles.input}
          maxLength={10}
          left={<TextInput.Affix text="+91 " />}
        />

        {(validationError || error) && (
          <Text style={styles.errorText}>
            {validationError || error}
          </Text>
        )}

        <TouchableOpacity
          onPress={handleContinue}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

#### src/screens/onboarding/OTPVerificationScreen.tsx
```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { useOTPVerification } from '../../hooks/useOTPVerification';
import { usePhoneVerification } from '../../hooks/usePhoneVerification';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export const OTPVerificationScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(300); // 5 minutes
  const [validationError, setValidationError] = useState('');
  const { verifyOTP } = useOTPVerification();
  const { resendOTP, loading } = usePhoneVerification();
  const { error } = useSelector((state: RootState) => state.onboarding);
  const { phone_number } = useSelector(
    (state: RootState) => state.onboarding
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyOTP = async () => {
    setValidationError('');

    if (!otp || otp.length !== 6) {
      setValidationError('Please enter a valid 6-digit OTP');
      return;
    }

    const success = await verifyOTP(otp);
    if (success) {
      navigation.navigate('ProfileSetup');
    }
  };

  const handleResendOTP = async () => {
    const success = await resendOTP();
    if (success) {
      setOtp('');
      setTimer(300);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to {phone_number}
        </Text>

        <TextInput
          label="OTP"
          value={otp}
          onChangeText={setOtp}
          placeholder="000000"
          keyboardType="number-pad"
          editable={!loading}
          style={styles.input}
          maxLength={6}
        />

        {(validationError || error) && (
          <Text style={styles.errorText}>
            {validationError || error}
          </Text>
        )}

        <TouchableOpacity
          onPress={handleVerifyOTP}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.timerText}>
            {timer > 0 ? formatTime(timer) : 'OTP expired'}
          </Text>
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={timer > 0 || loading}
          >
            <Text
              style={[
                styles.resendText,
                (timer > 0 || loading) && styles.resendDisabled,
              ]}
            >
              Resend OTP
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  timerText: {
    fontSize: 14,
    color: '#666',
  },
  resendText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#ccc',
  },
});
```

### 5.7 Input Validation Service

#### src/services/validators/phoneValidator.ts
```typescript
export const validatePhone = (phone: string): { valid: boolean; error?: string } => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length !== 10) {
    return { valid: false, error: 'Phone number must be 10 digits' };
  }
  
  if (!/^[6-9]/.test(cleanPhone[0])) {
    return { valid: false, error: 'Phone number must start with 6-9' };
  }
  
  return { valid: true };
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
};
```

#### src/services/validators/emailValidator.ts
```typescript
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email.trim()) {
    return { valid: false, error: 'Email is required' };
  }
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  return { valid: true };
};
```

---

## 6. Error Handling & Validation

### 6.1 Error Codes
```typescript
export enum OnboardingErrorCode {
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  PHONE_ALREADY_REGISTERED = 'PHONE_ALREADY_REGISTERED',
  OTP_INVALID = 'INVALID_OTP',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED = 'OTP_ATTEMPTS_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  INVALID_EMAIL = 'INVALID_EMAIL',
  EMAIL_ALREADY_REGISTERED = 'EMAIL_ALREADY_REGISTERED',
  INVALID_DOCUMENT = 'INVALID_DOCUMENT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}
```

### 6.2 Validation Rules
| Field | Validation | Error Message |
|-------|-----------|---------------|
| Phone | 10 digits, starts with 6-9 | Invalid phone number format |
| Email | Valid email format | Please enter a valid email |
| First Name | 2-50 chars, letters only | Enter a valid first name |
| Last Name | 2-50 chars, letters only | Enter a valid last name |
| DOB | Valid date, 18+ years old | Must be 18 years or older |
| Postal Code | 6 digits (India) | Invalid postal code |
| KYC Document | Image clarity, document visible | Document images are unclear |

---

## 7. Network Handling & Offline Support

### 7.1 Request/Response Interceptors
```typescript
// Add to API client
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

### 7.2 Offline Data Persistence
```typescript
// Save to AsyncStorage when offline
const saveDraftProfile = async (profile: FarmerProfile) => {
  await AsyncStorage.setItem('draft_profile', JSON.stringify(profile));
};

// Resume when online
const resumeOnboarding = async () => {
  const draft = await AsyncStorage.getItem('draft_profile');
  if (draft) {
    // Resume from saved state
  }
};
```

---

## 8. Security Considerations

### 8.1 Best Practices
- **OTP Handling:** Never log OTP codes; expire after 5 minutes
- **Token Storage:** Use Secure Storage/Keychain, not AsyncStorage
- **Image Upload:** Validate file size and MIME type before upload
- **HTTPS Only:** Enforce TLS 1.2+ for all API calls
- **Input Sanitization:** Validate all user inputs on client and server
- **Rate Limiting:** Limit OTP requests to 3 attempts per 5 minutes

### 8.2 Data Encryption
```typescript
import * as SecureStore from 'expo-secure-store';

// Store sensitive data securely
await SecureStore.setItemAsync('auth_token', token);
const token = await SecureStore.getItemAsync('auth_token');
```

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Phone validation
- Email validation
- Date validation
- OTP expiry logic

### 9.2 Integration Tests
- Phone verification flow
- OTP verification flow
- Profile creation
- KYC document upload

### 9.3 E2E Tests
- Complete onboarding journey
- Error scenarios (invalid OTP, network failure)
- Document resubmission flow

---

## 10. Performance Optimization

- **Image Compression:** Compress images before upload (max 5MB)
- **Request Batching:** Batch multiple requests when possible
- **Lazy Loading:** Load screens only when needed
- **Caching:** Cache frequently accessed data
- **Pagination:** Use pagination for lists

---

## 11. Deployment Checklist

- [ ] API endpoints tested in staging
- [ ] Database migrations executed
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Monitoring/alerting setup
- [ ] Backup strategy in place
- [ ] Security audit completed
- [ ] Documentation updated

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Draft
