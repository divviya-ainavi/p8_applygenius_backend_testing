import { Schema, model, Document } from 'mongoose';

interface IResumeComparison extends Document {
  userId: string;
  originalResumeId: string;
  enhancedResumeId: string;
  originalContent: string;
  enhancedContent: string;
  changes: Array<{
    type: 'addition' | 'deletion' | 'modification';
    originalText: string;
    enhancedText: string;
    section: string;
    startIndex: number;
    endIndex: number;
    aiReasoning: string;
    confidence: number;
    category: 'grammar' | 'content' | 'formatting' | 'structure' | 'optimization' | 'keyword';
  }>;
  comparisonMetadata: {
    totalChanges: number;
    additionsCount: number;
    deletionsCount: number;
    modificationsCount: number;
    improvementScore: number;
    sectionsModified: string[];
    keywordsAdded: string[];
    keywordsRemoved: string[];
  };
  aiModel: string;
  aiVersion: string;
  comparisonStatus: 'pending' | 'completed' | 'failed';
  processingTime: number;
  userFeedback: {
    rating: number;
    helpful: boolean;
    comments: string;
  };
  viewCount: number;
  lastViewedAt: Date;
  exportCount: number;
  lastExportedAt: Date;
}

const resumeComparisonSchema = new Schema<IResumeComparison>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  originalResumeId: {
    type: String,
    required: true,
    index: true
  },
  enhancedResumeId: {
    type: String,
    required: true,
    index: true
  },
  originalContent: {
    type: String,
    required: true
  },
  enhancedContent: {
    type: String,
    required: true
  },
  changes: [{
    type: {
      type: String,
      enum: ['addition', 'deletion', 'modification'],
      required: true
    },
    originalText: {
      type: String,
      default: ''
    },
    enhancedText: {
      type: String,
      default: ''
    },
    section: {
      type: String,
      required: true
    },
    startIndex: {
      type: Number,
      required: true
    },
    endIndex: {
      type: Number,
      required: true
    },
    aiReasoning: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    category: {
      type: String,
      enum: ['grammar', 'content', 'formatting', 'structure', 'optimization', 'keyword'],
      required: true
    }
  }],
  comparisonMetadata: {
    totalChanges: {
      type: Number,
      default: 0
    },
    additionsCount: {
      type: Number,
      default: 0
    },
    deletionsCount: {
      type: Number,
      default: 0
    },
    modificationsCount: {
      type: Number,
      default: 0
    },
    improvementScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    sectionsModified: [{
      type: String
    }],
    keywordsAdded: [{
      type: String
    }],
    keywordsRemoved: [{
      type: String
    }]
  },
  aiModel: {
    type: String,
    required: true,
    default: 'gpt-4'
  },
  aiVersion: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  comparisonStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  processingTime: {
    type: Number,
    default: 0
  },
  userFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    helpful: {
      type: Boolean
    },
    comments: {
      type: String,
      maxlength: 1000
    }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewedAt: {
    type: Date
  },
  exportCount: {
    type: Number,
    default: 0
  },
  lastExportedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'resumecomparisons'
});

// Indexes for performance
resumeComparisonSchema.index({ userId: 1, createdAt: -1 });
resumeComparisonSchema.index({ originalResumeId: 1, enhancedResumeId: 1 }, { unique: true });
resumeComparisonSchema.index({ comparisonStatus: 1 });

// Virtual for change summary
resumeComparisonSchema.virtual('changeSummary').get(function() {
  return {
    total: this.comparisonMetadata.totalChanges,
    additions: this.comparisonMetadata.additionsCount,
    deletions: this.comparisonMetadata.deletionsCount,
    modifications: this.comparisonMetadata.modificationsCount,
    score: this.comparisonMetadata.improvementScore
  };
});

// Pre-save middleware to calculate metadata
resumeComparisonSchema.pre('save', function(next) {
  if (this.isModified('changes')) {
    const additions = this.changes.filter(change => change.type === 'addition').length;
    const deletions = this.changes.filter(change => change.type === 'deletion').length;
    const modifications = this.changes.filter(change => change.type === 'modification').length;
    
    this.comparisonMetadata.totalChanges = this.changes.length;
    this.comparisonMetadata.additionsCount = additions;
    this.comparisonMetadata.deletionsCount = deletions;
    this.comparisonMetadata.modificationsCount = modifications;
    
    // Extract unique sections modified
    this.comparisonMetadata.sectionsModified = [...new Set(this.changes.map(change => change.section))];
    
    // Calculate improvement score based on change types and confidence
    const weightedScore = this.changes.reduce((score, change) => {
      const typeWeight = change.type === 'addition' ? 2 : change.type === 'modification' ? 1.5 : 0.5;
      return score + (change.confidence * typeWeight);
    }, 0);
    
    this.comparisonMetadata.improvementScore = Math.min(100, Math.round((weightedScore / this.changes.length) * 100));
  }
  next();
});

// Method to increment view count
resumeComparisonSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  this.lastViewedAt = new Date();
  return this.save();
};

// Method to increment export count
resumeComparisonSchema.methods.incrementExportCount = function() {
  this.exportCount += 1;
  this.lastExportedAt = new Date();
  return this.save();
};

// Static method to find comparisons by user
resumeComparisonSchema.statics.findByUser = function(userId: string) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to find comparison by resume IDs
resumeComparisonSchema.statics.findByResumeIds = function(originalId: string, enhancedId: string) {
  return this.findOne({ originalResumeId: originalId, enhancedResumeId: enhancedId });
};

export const ResumeComparison = model<IResumeComparison>('ResumeComparison', resumeComparisonSchema);