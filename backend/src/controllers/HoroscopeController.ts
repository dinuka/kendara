import HoroscopeRepo from '../repos/HoroscopeRepo';
import AuthUser from '../types/AuthUser';
import { notFound } from '../errors';
import CreateHoroscopeRequest from '../types/horoscope/CreateHoroscopeRequest';
import CreateHoroscopeResponse from '../types/horoscope/CreateHoroscopeResponse';
import ListHoroscopesResponse from '../types/horoscope/ListHoroscopesResponse';
import GetHoroscopeRequest from '../types/horoscope/GetHoroscopeRequest';
import GetHoroscopeResponse from '../types/horoscope/GetHoroscopeResponse';
import UpdateHoroscopeRequest from '../types/horoscope/UpdateHoroscopeRequest';
import UpdateHoroscopeResponse from '../types/horoscope/UpdateHoroscopeResponse';
import DeleteHoroscopeRequest from '../types/horoscope/DeleteHoroscopeRequest';
import DeleteHoroscopeResponse from '../types/horoscope/DeleteHoroscopeResponse';
import { parseHoroscopePdf } from '../lib/horoscopeParser';
import ParseHoroscopePdfResponse from '../types/horoscope/ParseHoroscopePdfResponse';
import { depopulateChartData } from '../lib/depopulateChartData';
import { populateChartData } from '../lib/populateChartData';
import { HoroscopePopulated } from '../models/HoroscopePopulated';
import Horoscope from '../models/Horoscope';

function populateHoroscope(doc: Horoscope): HoroscopePopulated {
  const { chartData: storedChartData, ...rest } = doc;
  return {
    ...rest,
    ...(storedChartData ? { chartData: populateChartData(storedChartData) } : {}),
  };
}

export default class HoroscopeController {
  constructor(private readonly horoscopeRepo: HoroscopeRepo) {}

  async create(
    { body }: CreateHoroscopeRequest,
    authUser: AuthUser
  ): Promise<CreateHoroscopeResponse> {
    const { name, birthTime, timezone, location, chartData } = body;
    const horoscope = await this.horoscopeRepo.create(
      authUser.id,
      name,
      new Date(birthTime),
      timezone,
      location.latitude,
      location.longitude,
      location.label,
      chartData ? depopulateChartData(chartData) : undefined
    );
    return { status: 201, data: { horoscope: populateHoroscope(horoscope) } };
  }

  async list(authUser: AuthUser): Promise<ListHoroscopesResponse> {
    const horoscopes = await this.horoscopeRepo.listByOwner(authUser.id);
    return { status: 200, data: { horoscopes: horoscopes.map(populateHoroscope) } };
  }

  async get({ params }: GetHoroscopeRequest, authUser: AuthUser): Promise<GetHoroscopeResponse> {
    const horoscope = await this.horoscopeRepo.findByIdAndOwner(params.id, authUser.id);
    if (!horoscope) throw notFound('Horoscope not found');
    return { status: 200, data: { horoscope: populateHoroscope(horoscope) } };
  }

  async update(
    { body, params }: UpdateHoroscopeRequest,
    authUser: AuthUser
  ): Promise<UpdateHoroscopeResponse> {
    const { name, birthTime, timezone, location, chartData } = body;
    const updated = await this.horoscopeRepo.update(
      params.id,
      authUser.id,
      name,
      new Date(birthTime),
      timezone,
      location.latitude,
      location.longitude,
      location.label,
      chartData ? depopulateChartData(chartData) : undefined
    );
    if (!updated) throw notFound('Horoscope not found');
    return { status: 200, data: { horoscope: populateHoroscope(updated) } };
  }

  async delete(
    { params }: DeleteHoroscopeRequest,
    authUser: AuthUser
  ): Promise<DeleteHoroscopeResponse> {
    const deleted = await this.horoscopeRepo.deleteByIdAndOwner(params.id, authUser.id);
    if (!deleted) throw notFound('Horoscope not found');
    return { status: 200, data: { success: true } };
  }

  async parsePdf({ filePath }: { filePath: string }): Promise<ParseHoroscopePdfResponse> {
    const parsed = await parseHoroscopePdf(filePath);
    return { status: 200, data: { parsed } };
  }
}
