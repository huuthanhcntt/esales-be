import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUserDto } from './dto/get-user.dto';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: {
    user: {
      create: jest.Mock;
      findFirstOrThrow: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        create: jest.fn(),
        findFirstOrThrow: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'StrongPass1!@',
    };

    it('should hash the password and call prisma.user.create', async () => {
      const hashedPassword = 'hashed-password';
      const createdUser = {
        id: 1,
        email: createUserDto.email,
        password: hashedPassword,
        roles: [],
      };

      // Email does not exist yet -> findFirstOrThrow throws (no record found)
      prismaService.user.findFirstOrThrow.mockRejectedValue(
        new Error('No User found'),
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      prismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...createUserDto,
          password: hashedPassword,
        },
      });
      expect(result).toEqual(createdUser);
    });

    it('should throw UnprocessableEntityException when email already exists', async () => {
      // Email exists -> findFirstOrThrow resolves (record found)
      prismaService.user.findFirstOrThrow.mockResolvedValue({
        id: 1,
        email: createUserDto.email,
      });

      await expect(service.create(createUserDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Email already exists.',
      );

      expect(prismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyUser', () => {
    const email = 'test@example.com';
    const password = 'StrongPass1!@';
    const user = {
      id: 1,
      email,
      password: 'hashed-password',
      roles: [],
    };

    it('should return the user when the password matches', async () => {
      prismaService.user.findFirstOrThrow.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyUser(email, password);

      expect(prismaService.user.findFirstOrThrow).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, user.password);
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when the password is wrong', async () => {
      prismaService.user.findFirstOrThrow.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyUser(email, password)).rejects.toThrow(
        'Credentials are not valid.',
      );
    });
  });

  describe('getUser', () => {
    it('should call prisma.user.findUniqueOrThrow with the correct id', async () => {
      const getUserDto: GetUserDto = { id: '42' };
      const user = { id: 42, email: 'test@example.com', password: 'hashed' };

      prismaService.user.findUniqueOrThrow.mockResolvedValue(user);

      const result = await service.getUser(getUserDto);

      expect(prismaService.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 42 },
      });
      expect(result).toEqual(user);
    });
  });
});
