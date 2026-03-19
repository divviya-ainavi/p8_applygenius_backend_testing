import { Schema, model, Document } from 'mongoose';

interface IKeywordExtraction extends Document {
  jobDescriptionHash: string;
  userId?: Schema.Types.ObjectId;
  originalJobDescription: string;
  extractedKeywords: {
    technicalSkills: Array<{
      keyword: string;
      confidence: number;
      category: 'programming' | 'tools' | 'frameworks' | 'databases' | 'platforms' | 'other';
      userModified: boolean;
    }>;
    softSkills: Array<{
      keyword: string;
      confidence: number;
      userModified: boolean;
    }>;
    requirements: Array<{
      requirement: string;
      type: 'education' | 'experience' | 'certification' | 'other';
      confidence: number;
      userModified: boolean;
    }>;
    qualifications: Array<{
      qualification: string;
      priority: 'required' | 'preferred' | 'nice-to-have';
      confidence: number;
      userModified: boolean;
    }>;
  };
  userModifications: {
    addedKeywords: Array<{
      keyword: string;
      category: 'technical' | 'soft' | 'requirement' | 'qualification';
      subcategory?: string;
      addedAt: Date;
    }>;
    removedKeywords: Array<{
      keyword: string;
      category: string;
      removedAt: Date;
    }>;
    modifiedKeywords: Array<{
      original: string;
      modified: string;
      category: string;
      modifiedAt: Date;
    }>;
  };
  extractionMetadata: {
    processingTime: number;
    aiModel: string;
    extractionVersion: string;
    totalKeywordsFound: number;
    averageConfidence: number;
  };
  status: 'processing' | 'completed' | 'error' | 'user_modified';
  errorMessage?: string;
  usageCount: number;
  lastUsed: Date;
  expiresAt: Date;
}

const keywordExtractionSchema = new Schema<IKeywordExtraction>({
  jobDescriptionHash: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  originalJobDescription: {
    type: String,
    required: true
  },
  extractedKeywords: {
    technicalSkills: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, required: true, min: 0, max: 1 },
      category: {
        type: String,
        enum: ['programming', 'tools', 'frameworks', 'databases', 'platforms', 'other'],
        default: 'other'
      },
      userModified: { type: Boolean, default: false }
    }],
    softSkills: [{
      keyword: { type: String, required: true },
      confidence: { type: Number, required: true, min: 0, max: 1 },
      userModified: { type: Boolean, default: false }
    }],
    requirements: [{
      requirement: { type: String, required: true },
      type: {
        type: String,
        enum: ['education', 'experience', 'certification', 'other'],
        default: 'other'
      },
      confidence: { type: Number, required: true, min: 0, max: 1 },
      userModified: { type: Boolean, default: false }
    }],
    qualifications: [{
      qualification: { type: String, required: true },
      priority: {
        type: String,
        enum: ['required', 'preferred', 'nice-to-have'],
        default: 'preferred'
      },
      confidence: { type: Number, required: true, min: 0, max: 1 },
      userModified: { type: Boolean, default: false }
    }]
  },
  userModifications: {
    addedKeywords: [{
      keyword: { type: String, required: true },
      category: {
        type: String,
        enum: ['technical', 'soft', 'requirement', 'qualification'],
        required: true
      },
      subcategory: String,
      addedAt: { type: Date, default: Date.now }
    }],
    removedKeywords: [{
      keyword: { type: String, required: true },
      category: { type: String, required: true },
      removedAt: { type: Date, default: Date.now }
    }],
    modifiedKeywords: [{
      original: { type: String, required: true },
      modified: { type: String, required: true },
      category: { type: String, required: true },
      modifiedAt: { type: Date, default: Date.now }
    }]
  },
  extractionMetadata: {
    processingTime: { type: Number, required: true },
    aiModel: { type: String, required: true },
    extractionVersion: { type: String, required: true },
    totalKeywordsFound: { type: Number, required: true, min: 0 },
    averageConfidence: { type: Number, required: true, min: 0, max: 1 }
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'error', 'user_modified'],
    default: 'processing',
    index: true
  },
  errorMessage: String,
  usageCount: {
    type: Number,
    default: 1,
    min: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  collection: 'keyword_extractions'
});

// Compound indexes for efficient queries
keywordExtractionSchema.index({ userId: 1, createdAt: -1 });
keywordExtractionSchema.index({ status: 1, createdAt: -1 });
keywordExtractionSchema.index({ lastUsed: -1 });

// Instance methods
keywordExtractionSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

keywordExtractionSchema.methods.markAsUserModified = function() {
  this.status = 'user_modified';
  return this.save();
};

keywordExtractionSchema.methods.getTotalKeywordCount = function() {
  const { technicalSkills, softSkills, requirements, qualifications } = this.extractedKeywords;
  return technicalSkills.length + softSkills.length + requirements.length + qualifications.length;
};

// Static methods
keywordExtractionSchema.statics.findByJobDescriptionHash = function(hash: string) {
  return this.findOne({ jobDescriptionHash: hash, status: { $in: ['completed', 'user_modified'] } });
};

keywordExtractionSchema.statics.findRecentByUser = function(userId: Schema.Types.ObjectId, limit: number = 10) {
  return this.find({ userId, status: { $in: ['completed', 'user_modified'] } })
    .sort({ lastUsed: -1 })
    .limit(limit);
};

keywordExtractionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ 
    expiresAt: { $lt: new Date() },
    usageCount: { $lte: 1 }
  });
};

export const KeywordExtraction = model<IKeywordExtraction>('KeywordExtraction', keywordExtractionSchema);