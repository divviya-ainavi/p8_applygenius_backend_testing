import { Schema, model, Document } from 'mongoose';

interface IInterviewAnswer extends Document {
  question: string;
  userAnswer?: string;
  suggestedAnswer: string;
  starFormat: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  feedback?: string;
  score?: number;
  practiced: boolean;
}

interface IInterviewPrep extends Document {
  userId: Schema.Types.ObjectId;
  applicationKitId: Schema.Types.ObjectId;
  jobTitle: string;
  companyName: string;
  questions: {
    behavioral: IInterviewAnswer[];
    technical: IInterviewAnswer[];
    situational: IInterviewAnswer[];
  };
  progress: {
    totalQuestions: number;
    answeredQuestions: number;
    practicedQuestions: number;
    averageScore: number;
    completionPercentage: number;
  };
  generationStatus: 'pending' | 'generating' | 'completed' | 'error';
  lastPracticedAt?: Date;
  isCompleted: boolean;
}

const interviewAnswerSchema = new Schema<IInterviewAnswer>({
  question: { type: String, required: true },
  userAnswer: { type: String, default: '' },
  suggestedAnswer: { type: String, required: true },
  starFormat: {
    situation: { type: String, required: true },
    task: { type: String, required: true },
    action: { type: String, required: true },
    result: { type: String, required: true }
  },
  feedback: { type: String, default: '' },
  score: { type: Number, min: 0, max: 10 },
  practiced: { type: Boolean, default: false }
}, { _id: false });

const interviewPrepSchema = new Schema<IInterviewPrep>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  applicationKitId: { type: Schema.Types.ObjectId, ref: 'ApplicationKit', required: true },
  jobTitle: { type: String, required: true },
  companyName: { type: String, required: true },
  questions: {
    behavioral: [interviewAnswerSchema],
    technical: [interviewAnswerSchema],
    situational: [interviewAnswerSchema]
  },
  progress: {
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    practicedQuestions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 }
  },
  generationStatus: { 
    type: String, 
    enum: ['pending', 'generating', 'completed', 'error'], 
    default: 'pending' 
  },
  lastPracticedAt: Date,
  isCompleted: { type: Boolean, default: false }
}, { timestamps: true });

interviewPrepSchema.index({ userId: 1, applicationKitId: 1 });
interviewPrepSchema.index({ userId: 1, createdAt: -1 });

interviewPrepSchema.methods.updateProgress = function() {
  const allQuestions = [
    ...this.questions.behavioral,
    ...this.questions.technical,
    ...this.questions.situational
  ];
  
  this.progress.totalQuestions = allQuestions.length;
  this.progress.answeredQuestions = allQuestions.filter(q => q.userAnswer).length;
  this.progress.practicedQuestions = allQuestions.filter(q => q.practiced).length;
  
  const scoredQuestions = allQuestions.filter(q => q.score !== undefined);
  this.progress.averageScore = scoredQuestions.length > 0 
    ? scoredQuestions.reduce((sum, q) => sum + q.score, 0) / scoredQuestions.length 
    : 0;
  
  this.progress.completionPercentage = this.progress.totalQuestions > 0
    ? Math.round((this.progress.practicedQuestions / this.progress.totalQuestions) * 100)
    : 0;
    
  this.isCompleted = this.progress.completionPercentage >= 80;
};

export const InterviewPrep = model<IInterviewPrep>('InterviewPrep', interviewPrepSchema);