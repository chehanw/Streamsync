import { BackendService, BackendConfig } from './types';
import { LocalStorageBackend } from './backends/local-storage';
import { AccountService, type IAccountService } from './account-service';
import { FirebaseAccountService } from './firebase-account-service';

/**
 * Factory to create the appropriate backend and account services
 */
export class BackendFactory {
  static createBackend(config: BackendConfig): BackendService {
    switch (config.type) {
      case 'local':
        return new LocalStorageBackend();
      default:
        console.warn(`Backend type ${config.type} not available, falling back to local storage`);
        return new LocalStorageBackend();
    }
  }

  static createAccountService(config: BackendConfig): IAccountService {
    switch (config.type) {
      case 'firebase':
        return new FirebaseAccountService();
      case 'local':
      default:
        return AccountService;
    }
  }
}
