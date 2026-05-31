import { UnauthorizedException } from '@nestjs/common';
import { LocalStategy } from './local.strategy';
import { UsersService } from '../users/users.service';

describe('LocalStrategy', () => {
  let strategy: LocalStategy;
  let usersService: Partial<UsersService>;

  beforeEach(() => {
    usersService = {
      verifyUser: jest.fn(),
    };
    strategy = new LocalStategy(usersService as UsersService);
  });

  it('should return user when credentials are valid', async () => {
    const user = { id: 1, email: 'test@test.com' };
    (usersService.verifyUser as jest.Mock).mockResolvedValue(user);

    const result = await strategy.validate('test@test.com', 'password');
    expect(result).toEqual(user);
    expect(usersService.verifyUser).toHaveBeenCalledWith('test@test.com', 'password');
  });

  it('should throw UnauthorizedException when credentials are invalid', async () => {
    (usersService.verifyUser as jest.Mock).mockRejectedValue(
      new UnauthorizedException(),
    );

    await expect(strategy.validate('bad@test.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
