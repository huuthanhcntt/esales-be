import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_EXPIRATION') return 3600;
      return null;
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('jwt-token-123'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should sign JWT and set cookie on response', async () => {
      const user = { id: 1, email: 'test@test.com', password: 'hash', roles: [] } as any;
      const response = { cookie: jest.fn() } as any;

      const token = await service.login(user, response);

      expect(jwtService.sign).toHaveBeenCalledWith({ userId: 1 });
      expect(response.cookie).toHaveBeenCalledWith(
        'Authentication',
        'jwt-token-123',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(token).toBe('jwt-token-123');
    });
  });
});
