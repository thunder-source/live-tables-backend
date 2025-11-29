import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { View } from './entities/view.entity';
import { ViewsService } from './services/views.service';
import { ViewExecutorService } from './services/view-executor.service';
import { FormulaEvaluatorService } from './services/formula-evaluator.service';
import { ViewsController } from './controllers/views.controller';
import { BasesModule } from '../bases/bases.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([View]),
    BasesModule, // Import for InternalDbExecutorService
  ],
  controllers: [ViewsController],
  providers: [
    ViewsService,
    ViewExecutorService,
    FormulaEvaluatorService,
  ],
  exports: [
    ViewsService,
    ViewExecutorService,
    FormulaEvaluatorService,
  ],
})
export class ViewsModule {}
