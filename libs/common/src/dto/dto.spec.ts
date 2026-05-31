import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateChargeDto } from './create-charge.dto';
import { CardDto } from './card.dto';

describe('CardDto', () => {
  function createCard(overrides: Partial<CardDto> = {}): CardDto {
    return plainToInstance(CardDto, {
      cvc: '123',
      exp_month: 12,
      exp_year: 2027,
      number: '4242424242424242',
      ...overrides,
    });
  }

  it('should pass with valid card data', async () => {
    const dto = createCard();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when cvc is empty', async () => {
    const dto = createCard({ cvc: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('cvc');
  });

  it('should fail when exp_month is not a number', async () => {
    const dto = createCard({ exp_month: 'twelve' as any });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'exp_month')).toBe(true);
  });

  it('should fail when card number is invalid', async () => {
    const dto = createCard({ number: '1234' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'number')).toBe(true);
  });
});

describe('CreateChargeDto', () => {
  function createCharge(overrides: any = {}): CreateChargeDto {
    return plainToInstance(CreateChargeDto, {
      amount: 100,
      card: {
        cvc: '123',
        exp_month: 12,
        exp_year: 2027,
        number: '4242424242424242',
      },
      ...overrides,
    });
  }

  it('should pass with valid charge data', async () => {
    const dto = createCharge();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when amount is not a number', async () => {
    const dto = createCharge({ amount: 'fifty' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should fail when card is missing', async () => {
    const dto = plainToInstance(CreateChargeDto, { amount: 100 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'card')).toBe(true);
  });

  it('should fail when card is empty object', async () => {
    const dto = createCharge({ card: {} });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
