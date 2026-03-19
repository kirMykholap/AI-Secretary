import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { TickTickAdapter } from '../../infrastructure/adapters/ticktick.adapter';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('OAuth')
@Controller('oauth/ticktick')
export class TickTickAuthController {
  private readonly logger = new Logger(TickTickAuthController.name);

  constructor(private readonly tickTickAdapter: TickTickAdapter) {}

  @Get('login')
  @ApiOperation({ summary: 'Redirects to TickTick authorization page' })
  async login(@Res() res: Response) {
    const clientId = process.env.TICKTICK_CLIENT_ID;
    const redirectUri = process.env.TICKTICK_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return res.status(500).send('TickTick OAuth config missing (TICKTICK_CLIENT_ID or TICKTICK_REDIRECT_URI)');
    }

    const state = 'ticktick_auth';
    const authUrl = `https://ticktick.com/oauth/authorize?scope=tasks:write tasks:read&client_id=${clientId}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    
    this.logger.log(`Redirecting to TickTick OAuth: ${authUrl}`);
    res.redirect(authUrl);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Callback URL for TickTick OAuth' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.error(`TickTick OAuth error: ${error}`);
      return res.status(400).send(`OAuth Error: ${error}`);
    }

    if (!code) {
      return res.status(400).send('No authorization code provided');
    }

    try {
      this.logger.log('Exchanging code for token...');
      await this.tickTickAdapter.exchangeCodeForToken(code);
      return res.send('Successfully authenticated with TickTick! Tokens saved to Database. You can close this window.');
    } catch (err) {
      this.logger.error(`Failed to exchange token: ${err.message}`);
      return res.status(500).send(`Failed to authenticate: ${err.message}`);
    }
  }
}
