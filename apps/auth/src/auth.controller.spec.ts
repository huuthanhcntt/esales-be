import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn().mockResolvedValue('jwt-token-123'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login and send JWT', async () => {
      const user = { id: 1, email: 'test@test.com' } as any;
      const response = { send: jest.fn() } as any;

      await controller.login(user, response);

      expect(authService.login).toHaveBeenCalledWith(user, response);
      expect(response.send).toHaveBeenCalledWith('jwt-token-123');
    });
  });

  describe('authenticate', () => {
    it('should return user from payload', async () => {
      const data = { user: { id: 1, email: 'test@test.com' } };
      const result = await controller.authenticate(data);
      expect(result).toEqual(data.user);
    });
  });
});
