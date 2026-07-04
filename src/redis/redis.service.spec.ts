import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../config';
import { RedisService } from './redis.service';

const mockRedisClient = {
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedisClient),
  };
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: AppConfigService,
          useValue: { redisUrl: 'redis://localhost:6379' },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get a value by key', async () => {
    mockRedisClient.get.mockResolvedValue('cached-value');

    const result = await service.get('movie:550');

    expect(result).toBe('cached-value');
    expect(mockRedisClient.get).toHaveBeenCalledWith('movie:550');
  });

  it('should set a value without TTL', async () => {
    await service.set('movie:550', 'data');

    expect(mockRedisClient.set).toHaveBeenCalledWith('movie:550', 'data');
  });

  it('should set a value with TTL', async () => {
    await service.set('movie:550', 'data', 300);

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'movie:550',
      'data',
      'EX',
      300,
    );
  });

  it('should delete a key', async () => {
    await service.delete('movie:550');

    expect(mockRedisClient.del).toHaveBeenCalledWith('movie:550');
  });
});
