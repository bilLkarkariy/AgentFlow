import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Create a new user */
  async createUser(dto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }

  /** Get all users */
  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  /** Get a single user by ID */
  async findOne(id: string): Promise<User> {
    return this.userRepo.findOneOrFail({ where: { id } });
  }

  /** Update user by ID */
  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    await this.userRepo.update(id, dto);
    return this.findOne(id);
  }

  /**
   * Supprime un utilisateur par ID (RGPD)
   */
  async deleteUser(id: string): Promise<void> {
    await this.userRepo.delete(id);
  }
}
