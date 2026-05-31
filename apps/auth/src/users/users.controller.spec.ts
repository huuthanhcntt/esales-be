import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { create: jest.Mock };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('createUser', () => {
    it('should call usersService.create with the dto', async () => {
      const dto: CreateUserDto = {
        email: 'test@example.com',
        password: 'StrongPass1!@',
      };
      const createdUser = { id: 1, ...dto };

      usersService.create.mockResolvedValue(createdUser);

      const result = await controller.createUser(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(createdUser);
    });
  });

  describe('getUser', () => {
    it('should return the user from @CurrentUser()', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed',
        roles: ['Admin'],
      };

      const result = await controller.getUser(user as any);

      expect(result).toEqual(user);
    });
  });
});
