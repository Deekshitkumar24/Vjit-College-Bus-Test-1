export interface MfaEnrolmentData {
  secret: string;
  qrCodeUri: string;
  recoveryCodes: string[];
}

export interface MfaEnrolmentState {
  step: 'INITIAL' | 'DISPLAY_QR' | 'SAVE_RECOVERY_CODES' | 'VERIFY_TOTP' | 'COMPLETED';
  secret: string | null;
  qrCodeUri: string | null;
  recoveryCodes: string[];
  recoveryCodesConfirmed: boolean;
  error: string | null;
}

export class MfaEnrolmentManager {
  private state: MfaEnrolmentState = {
    step: 'INITIAL',
    secret: null,
    qrCodeUri: null,
    recoveryCodes: [],
    recoveryCodesConfirmed: false,
    error: null,
  };

  public loadEnrolmentPayload(payload: {
    secret: string;
    qr_code_uri: string;
    recovery_codes: string[];
  }): void {
    if (!payload.secret || !payload.qr_code_uri || payload.recovery_codes.length !== 10) {
      throw new Error('Invalid MFA enrolment payload: 10 recovery codes required');
    }

    this.state = {
      step: 'DISPLAY_QR',
      secret: payload.secret,
      qrCodeUri: payload.qr_code_uri,
      recoveryCodes: [...payload.recovery_codes],
      recoveryCodesConfirmed: false,
      error: null,
    };
  }

  public proceedToRecoveryCodes(): void {
    if (this.state.step !== 'DISPLAY_QR') {
      throw new Error('Cannot proceed to recovery codes before displaying QR');
    }
    this.state.step = 'SAVE_RECOVERY_CODES';
  }

  public confirmRecoveryCodesSaved(): void {
    if (this.state.step !== 'SAVE_RECOVERY_CODES') {
      throw new Error('Cannot confirm recovery codes at this step');
    }
    this.state.recoveryCodesConfirmed = true;
    this.state.step = 'VERIFY_TOTP';
  }

  public validateTotpCode(code: string): { valid: boolean; error?: string } {
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return { valid: false, error: 'TOTP code must be exactly 6 digits' };
    }
    return { valid: true };
  }

  public completeEnrolment(code: string): { success: boolean; error?: string } {
    if (this.state.step !== 'VERIFY_TOTP') {
      return { success: false, error: 'MFA is not ready for TOTP verification' };
    }

    if (!this.state.recoveryCodesConfirmed) {
      return { success: false, error: 'Recovery codes must be confirmed saved before completing MFA' };
    }

    const validation = this.validateTotpCode(code);
    if (!validation.valid) {
      this.state.error = validation.error ?? 'Invalid code';
      return { success: false, error: this.state.error };
    }

    this.state.step = 'COMPLETED';
    this.state.error = null;
    return { success: true };
  }

  public getState(): Readonly<MfaEnrolmentState> {
    return { ...this.state, recoveryCodes: [...this.state.recoveryCodes] };
  }

  public reset(): void {
    this.state = {
      step: 'INITIAL',
      secret: null,
      qrCodeUri: null,
      recoveryCodes: [],
      recoveryCodesConfirmed: false,
      error: null,
    };
  }
}
